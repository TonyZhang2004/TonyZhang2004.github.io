"""Optional font maintenance tool; the website itself has no build step.

Convert the accompanying GPL v2 Type 1 source fonts to WOFF2 with FontTools and
Brotli. Keep the original source files and COPYING with outputs. COPYING also
preserves the upstream distribution notes.
"""

from pathlib import Path

from fontTools import agl
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.t1Lib import T1Font


SOURCE = Path(__file__).resolve().parent
OUTPUT = SOURCE.parent
FACES = (
    ("uplr8a", "roman", "Regular", 400, 64, 0),
    ("uplri8a", "italic", "Italic", 400, 1, 2),
    ("uplb8a", "bold", "Bold", 700, 32, 1),
)


def convert(source_name, output_name, style, weight, selection, mac_style):
    original = T1Font(str(SOURCE / f"{source_name}.pfb"))
    glyphs = original.getGlyphSet()
    order = [".notdef"] + sorted(set(glyphs) - {".notdef"})
    character_map, metrics, charstrings = {}, {}, {}

    for name in order:
        glyph = glyphs[name]
        bounds = BoundsPen(glyphs)
        glyph.draw(bounds)
        width = round(glyph.width)
        pen = T2CharStringPen(width, glyphs)
        glyph.draw(pen)
        charstrings[name] = pen.getCharString()
        metrics[name] = (width, round(bounds.bounds[0]) if bounds.bounds else 0)
        text = agl.toUnicode(name)
        if len(text) == 1:
            character_map.setdefault(ord(text), name)

    font = FontBuilder(1000, isTTF=False)
    font.setupGlyphOrder(order)
    font.setupCharacterMap(character_map)
    font.setupHorizontalMetrics(metrics)
    font.setupHorizontalHeader(ascent=800, descent=-250, lineGap=0)

    info = original["FontInfo"]
    postscript_name = original["FontName"]
    font.setupNameTable({
        "familyName": "URW Palladio L",
        "styleName": style,
        "uniqueFontIdentifier": f"{postscript_name}-Web",
        "fullName": info["FullName"],
        "psName": postscript_name,
        "version": "Version " + str(info.get("version", "1.05")),
        "copyright": info.get("Notice", ""),
        "licenseDescription": (
            "GNU GPL v2. Source: CTAN fonts/urw/base35. Converted from Type 1 "
            "to WOFF2; glyph outlines, advance widths, and AFM kerning retained."
        ),
        "licenseInfoURL": "https://ctan.net/fonts/urw/base35/COPYING",
    })
    font.setupOS2(
        sTypoAscender=800,
        sTypoDescender=-250,
        sTypoLineGap=0,
        usWinAscent=1050,
        usWinDescent=300,
        usWeightClass=weight,
        fsSelection=selection,
        sxHeight=469,
        sCapHeight=692,
    )
    font.setupPost(italicAngle=info.get("ItalicAngle", 0))

    private_keys = (
        "BlueValues", "OtherBlues", "FamilyBlues", "FamilyOtherBlues",
        "BlueScale", "BlueShift", "BlueFuzz", "StdHW", "StdVW",
        "StemSnapH", "StemSnapV", "ForceBold",
    )
    private = {
        key: original["Private"][key]
        for key in private_keys if key in original["Private"]
    }
    # Empty Type 1 hint arrays must be omitted from a CFF private dictionary.
    private = {
        key: value for key, value in private.items()
        if not isinstance(value, list) or value
    }
    # Type 1 stores standard stem widths in one-item arrays; CFF expects scalars.
    for key in ("StdHW", "StdVW"):
        if key in private:
            private[key] = private[key][0]
    font.setupCFF(
        postscript_name,
        {
            "FullName": info["FullName"],
            "FamilyName": info["FamilyName"],
            "Weight": info["Weight"],
            "ItalicAngle": info.get("ItalicAngle", 0),
            "Notice": info.get("Notice", ""),
        },
        charstrings,
        private,
    )

    pairs = []
    afm = (SOURCE / f"{source_name}.afm").read_text(encoding="latin-1")
    for line in afm.splitlines():
        if line.startswith("KPX "):
            _, left, right, value = line.split()
            if left in glyphs and right in glyphs:
                pairs.append(f"pos \\{left} \\{right} {int(float(value))};")
    if pairs:
        addOpenTypeFeaturesFromString(
            font.font, "feature kern {\n" + "\n".join(pairs) + "\n} kern;"
        )

    font.font["head"].macStyle = mac_style
    font.font.flavor = "woff2"
    font.save(str(OUTPUT / f"palladio-{output_name}.woff2"))
    print(f"{postscript_name}: {len(order)} glyphs, {len(pairs)} kerning pairs")


if __name__ == "__main__":
    for face in FACES:
        convert(*face)
