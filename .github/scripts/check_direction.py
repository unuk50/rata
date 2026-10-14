"""Exit 0 if the text on stdin has 'Direction: docs/product/<file>#<section>'
that names an existing file under docs/product and one of its Markdown headings."""

import pathlib
import re
import sys

ROOT = pathlib.Path("docs/product").resolve()


def slugs(text: str) -> set[str]:
    """GitHub-style heading anchors, with -1, -2 for repeats."""
    seen: dict[str, int] = {}
    out: set[str] = set()
    for line in text.splitlines():
        m = re.match(r"^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$", line)
        if not m:
            continue
        slug = re.sub(r"[^\w\- ]", "", re.sub(r"<[^>]*>", "", m.group(1)).lower())
        slug = slug.replace(" ", "-")
        n = seen.get(slug, 0)
        seen[slug] = n + 1
        out.add(slug if n == 0 else f"{slug}-{n}")
    return out


def main() -> int:
    for path_name, fragment in re.findall(
        r"direction:\s*`?(docs/product/[^`\s#]+)#([^`\s]+)", sys.stdin.read(), re.I
    ):
        path = pathlib.Path(path_name).resolve()
        if ROOT in path.parents and path.is_file():
            if fragment.lower() in slugs(path.read_text(encoding="utf-8")):
                return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
