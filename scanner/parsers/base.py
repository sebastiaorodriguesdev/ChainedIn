from abc import ABC, abstractmethod
from pathlib import Path

from ..models import Dependency


class BaseParser(ABC):
    FILENAMES: list[str] = []
    ECOSYSTEM: str = ""

    @abstractmethod
    def parse(self, path: Path) -> list[Dependency]:
        ...

    def can_parse(self, path: Path) -> bool:
        return path.name in self.FILENAMES
