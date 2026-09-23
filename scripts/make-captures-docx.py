# ARTICLE_CAPTURES.md -> a Word document, so the same log exists in both places.
#
# Ruth reads Word, not Markdown, and the repo needs the Markdown. Rather than
# writing the thing twice and letting the two drift, this builds the .docx FROM
# the .md every time, so the repo file is the single source and the Word doc is
# a rendering of it.
#
#   python make-captures-docx.py
#
# WHY THIS BUILDS THE ZIP BY HAND rather than using python-docx: the file has to
# be uploaded to Drive as base64 through a tool call, and python-docx's default
# template alone is about 36 KB before a word of content, which base64 expands
# past what can be passed in one piece. A .docx is only a zip of XML, and the
# parts below are the minimum Word needs. The result is around a tenth of the
# size and opens identically.
#
# Run it again after appending a capture, then re-upload.

import os
import re
import sys
import zipfile

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\ruthi\unflump-app\ARTICLE_CAPTURES.md"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "Selodia Article Captures.docx")

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def esc(s):
    return (
        s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )


def para(text, size=22, bold=False, colour="2D2B28", caps=False, italic=False, before=0, after=140):
    """size is half-points, the unit Word actually stores."""
    runprops = f'<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="{size}"/><w:color w:val="{colour}"/>'
    if bold:
        runprops += "<w:b/>"
    if italic:
        runprops += "<w:i/>"
    if caps:
        runprops += "<w:caps/><w:spacing w:val="'"30"'"/>"
    return (
        f'<w:p><w:pPr><w:spacing w:before="{before}" w:after="{after}" w:line="264" w:lineRule="auto"/></w:pPr>'
        f"<w:r><w:rPr>{runprops}</w:rPr><w:t xml:space=\"preserve\">{esc(text)}</w:t></w:r></w:p>"
    )


with open(SRC, encoding="utf-8") as fh:
    lines = fh.read().split("\n")

body = []
in_entries = False  # prose before the first entry is the standfirst

for line in lines:
    line = line.rstrip()

    if line.startswith("# "):
        body.append(para(line[2:], size=52, bold=True, after=60))

    elif line.startswith("## "):
        # "23 September 2026 — One-line context" becomes a small coloured date
        # label above the context, because the date is a label and the context
        # is the title. Accepts em, en and hyphen, since typing habits vary.
        text = line[3:]
        parts = re.split(r"\s+[\u2014\u2013-]\s+", text, maxsplit=1)
        date = parts[0]
        context = parts[1] if len(parts) > 1 else ""
        in_entries = True
        body.append(para(date, size=17, bold=True, colour="874C3A", caps=True, before=360, after=0))
        if context:
            body.append(para(context, size=28, bold=True, after=80))

    elif line.strip() == "---":
        continue  # the spacing above already separates entries

    elif line.strip():
        if in_entries:
            body.append(para(line.strip()))
        else:
            body.append(para(line.strip(), size=21, colour="605A52", italic=True))

body.append(
    para(
        "Generated from ARTICLE_CAPTURES.md in the repo. Edit the Markdown, then run "
        "make-captures-docx.py and re-upload, so the two never drift apart.",
        size=17,
        colour="605A52",
        italic=True,
        before=400,
    )
)

document = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f"<w:document {W}><w:body>" + "".join(body) +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
    "</w:body></w:document>"
)

content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    "</Types>"
)

rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    "</Relationships>"
)

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document)

print(OUT)
print(os.path.getsize(OUT), "bytes")
