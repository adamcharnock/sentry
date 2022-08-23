from typing import Any, ClassVar, Mapping, MutableMapping, Optional, Sequence, Tuple, Type, cast

from sentry.grouping.mypyc.exceptions import InvalidEnhancerConfig
from sentry.grouping.utils import get_rule_bool
from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path

from .utils import cached

# from .enhancers import InvalidEnhancerConfig

MATCH_KEYS = {
    "path": "p",
    "function": "f",
    "module": "m",
    "family": "F",
    "package": "P",
    "app": "a",
    "type": "t",
    "value": "v",
    "mechanism": "M",
    "category": "c",
}
SHORT_MATCH_KEYS = {v: k for k, v in MATCH_KEYS.items()}

assert len(SHORT_MATCH_KEYS) == len(MATCH_KEYS)  # assert short key names are not reused

FAMILIES = {"native": "N", "javascript": "J", "all": "a"}
REVERSE_FAMILIES = {v: k for k, v in FAMILIES.items()}


MATCHERS = {
    # discover field names
    "stack.module": "module",
    "stack.abs_path": "path",
    "stack.package": "package",
    "stack.function": "function",
    "error.type": "type",
    "error.value": "value",
    "error.mechanism": "mechanism",
    # fingerprinting shortened fields
    "module": "module",
    "path": "path",
    "package": "package",
    "function": "function",
    "category": "category",
    # fingerprinting specific fields
    "family": "family",
    "app": "app",
}


FrameData = Mapping[str, Any]
MatchFrame = MutableMapping[str, Any]  # TODO


def _get_function_name(frame_data: FrameData, platform: Optional[str]) -> str:

    function_name = get_function_name_for_frame(frame_data, platform)

    return function_name or "<unknown>"


def create_match_frame(frame_data: FrameData, platform: Optional[str]) -> MatchFrame:
    """Create flat dict of values relevant to matchers"""
    match_frame = dict(
        category=get_path(frame_data, "data", "category"),
        family=get_behavior_family_for_platform(frame_data.get("platform") or platform),
        function=_get_function_name(frame_data, platform),
        in_app=frame_data.get("in_app"),
        module=get_path(frame_data, "module"),
        package=frame_data.get("package"),
        path=frame_data.get("abs_path") or frame_data.get("filename"),
    )

    for key in list(match_frame.keys()):
        value = match_frame[key]
        if isinstance(value, (bytes, str)):
            if key in ("package", "path"):
                value = match_frame[key] = value.lower()

            if isinstance(value, str):
                match_frame[key] = value.encode("utf-8")

    return match_frame


Frame = Any  # TODO
ExceptionData = Any  # TODO
MatchingCache = MutableMapping[str, Any]  # TODO


class Match:
    @property
    def description(self) -> str:
        raise NotImplementedError()

    def matches_frame(
        self,
        frames: Sequence[Frame],
        idx: int,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        raise NotImplementedError()

    def _to_config_structure(self, version: int) -> str:
        raise NotImplementedError()

    @staticmethod
    def _from_config_structure(obj: str, version: int) -> "Match":
        val = obj
        if val.startswith("|[") and val.endswith("]"):
            return CalleeMatch(Match._from_config_structure(val[2:-1], version))
        if val.startswith("[") and val.endswith("]|"):
            return CallerMatch(Match._from_config_structure(val[1:-2], version))

        if val.startswith("!"):
            negated = True
            val = val[1:]
        else:
            negated = False
        key = SHORT_MATCH_KEYS[val[0]]
        if key == "family":
            arg = ",".join(_f for _f in [REVERSE_FAMILIES.get(x) for x in val[1:]] if _f)
        else:
            arg = val[1:]

        return FrameMatch.from_key(key, arg, negated)


InstanceKey = Tuple[str, str, bool]


class FrameMatch(Match):

    # Global registry of matchers
    instances: ClassVar[MutableMapping[InstanceKey, "FrameMatch"]] = {}

    @classmethod
    def from_key(cls, key: str, pattern: str, negated: bool) -> "FrameMatch":

        instance_key = (key, pattern, negated)
        if instance_key in cls.instances:
            instance = cls.instances[instance_key]
        else:
            instance = cls.instances[instance_key] = cls._from_key(key, pattern, negated)

        return instance

    @classmethod
    def _from_key(cls, key: str, pattern: str, negated: bool) -> "FrameMatch":

        subclass: Type["FrameMatch"] = {
            "package": PackageMatch,
            "path": PathMatch,
            "family": FamilyMatch,
            "app": InAppMatch,
            "function": FunctionMatch,
            "module": ModuleMatch,
            "category": CategoryMatch,
            "type": ExceptionTypeMatch,
            "value": ExceptionValueMatch,
            "mechanism": ExceptionMechanismMatch,
        }[MATCHERS[key]]

        return subclass(key, pattern, negated)

    def __init__(self, key: str, pattern: str, negated: bool = False):
        super().__init__()
        try:
            self.key = MATCHERS[key]
        except KeyError:
            raise InvalidEnhancerConfig("Unknown matcher '%s'" % key)
        self.pattern = pattern
        self._encoded_pattern = pattern.encode("utf-8")
        self.negated = negated

    @property
    def description(self) -> str:
        return "{}:{}".format(
            self.key,
            self.pattern.split() != [self.pattern] and '"%s"' % self.pattern or self.pattern,
        )

    def matches_frame(
        self,
        frames: Sequence[Frame],
        idx: int,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        match_frame = frames[idx]
        rv = self._positive_frame_match(match_frame, platform, exception_data, cache)
        if self.negated:
            rv = not rv
        return rv

    def _positive_frame_match(
        self,
        match_frame: MatchFrame,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        # Implement is subclasses
        raise NotImplementedError

    def _to_config_structure(self, version: int) -> str:
        if self.key == "family":
            arg = "".join(_f for _f in [FAMILIES.get(x) for x in self.pattern.split(",")] if _f)
        elif self.key == "app":
            arg = {True: "1", False: "0"}.get(get_rule_bool(self.pattern) or False, "")
        else:
            arg = self.pattern
        return ("!" if self.negated else "") + MATCH_KEYS[self.key] + arg


def path_like_match(pattern: bytes, value: bytes) -> bool:
    """Stand-alone function for use with ``cached``"""
    if glob_match(value, pattern, ignorecase=False, doublestar=True, path_normalize=True):
        return True
    if not value.startswith(b"/") and glob_match(
        b"/" + value, pattern, ignorecase=False, doublestar=True, path_normalize=True
    ):
        return True

    return False


class PathLikeMatch(FrameMatch):

    field: str

    def __init__(self, key: str, pattern: str, negated: bool = False):
        super().__init__(key, pattern.lower(), negated)

    def _positive_frame_match(
        self,
        match_frame: MatchFrame,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        value = match_frame[self.field]
        if value is None:
            return False

        return cast(bool, cached(cache, path_like_match, self._encoded_pattern, value))


class PackageMatch(PathLikeMatch):

    field = "package"


class PathMatch(PathLikeMatch):

    field = "path"


class FamilyMatch(FrameMatch):
    def __init__(self, key: str, pattern: str, negated: bool = False):
        super().__init__(key, pattern, negated)
        self._flags = set(self._encoded_pattern.split(b","))

    def _positive_frame_match(
        self,
        match_frame: MatchFrame,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        if b"all" in self._flags:
            return True

        return match_frame["family"] in self._flags


class InAppMatch(FrameMatch):
    def __init__(self, key: str, pattern: str, negated: bool = False):
        super().__init__(key, pattern, negated)
        self._ref_val = get_rule_bool(self.pattern)

    def _positive_frame_match(
        self,
        match_frame: MatchFrame,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        ref_val = self._ref_val
        return ref_val is not None and ref_val == match_frame["in_app"]


class FunctionMatch(FrameMatch):
    def _positive_frame_match(
        self,
        match_frame: MatchFrame,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:

        return cast(bool, cached(cache, glob_match, match_frame["function"], self._encoded_pattern))


class FrameFieldMatch(FrameMatch):

    field: ClassVar[str]

    def _positive_frame_match(
        self,
        match_frame: MatchFrame,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        field = match_frame[self.field]
        if field is None:
            return False

        return cast(bool, cached(cache, glob_match, field, self._encoded_pattern))


class ModuleMatch(FrameFieldMatch):

    field = "module"


class CategoryMatch(FrameFieldMatch):

    field = "category"


class ExceptionFieldMatch(FrameMatch):

    field_path: ClassVar[Sequence[str]]

    def _positive_frame_match(
        self,
        match_frame: MatchFrame,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        field = get_path(exception_data, *self.field_path) or "<unknown>"
        return cast(bool, cached(cache, glob_match, field, self._encoded_pattern))


class ExceptionTypeMatch(ExceptionFieldMatch):

    field_path = ["type"]


class ExceptionValueMatch(ExceptionFieldMatch):

    field_path = ["value"]


class ExceptionMechanismMatch(ExceptionFieldMatch):

    field_path = ["mechanism", "type"]


class CallerMatch(Match):
    def __init__(self, caller: Match):
        self.caller = caller

    @property
    def description(self) -> str:
        return f"[ {self.caller.description} ] |"

    def _to_config_structure(self, version: int) -> str:
        return f"[{self.caller._to_config_structure(version)}]|"

    def matches_frame(
        self,
        frames: Sequence[Frame],
        idx: int,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        return idx > 0 and self.caller.matches_frame(
            frames, idx - 1, platform, exception_data, cache
        )


class CalleeMatch(Match):
    def __init__(self, caller: Match):
        self.caller = caller

    @property
    def description(self) -> str:
        return f"| [ {self.caller.description} ]"

    def _to_config_structure(self, version: int) -> str:
        return f"|[{self.caller._to_config_structure(version)}]"

    def matches_frame(
        self,
        frames: Sequence[Frame],
        idx: int,
        platform: str,
        exception_data: ExceptionData,
        cache: MatchingCache,
    ) -> bool:
        return idx < len(frames) - 1 and self.caller.matches_frame(
            frames, idx + 1, platform, exception_data, cache
        )
