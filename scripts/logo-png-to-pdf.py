"""Put a transparent PNG into a PDF, the way Logo Asset Pack v2.0 already does it.

    python logo-png-to-pdf.py <in.png> <out.pdf> <width_pt> <height_pt>

THE PACK'S PDFs ARE RASTER AND THIS MATCHES THEM. Inspecting
selodia-lockup-stacked-charcoal-transparent.pdf on 8 October 2026 found an
/Image XObject, no /Form, and "ReportLab PDF Library" as the producer. There is
no vector path data in any of them.

That is worth knowing and not worth quietly fixing here. A single vector PDF
sitting in a folder of raster ones is a difference nobody would notice until the
day it mattered, and the right fix is to rebuild the whole pack rather than make
one file better than its siblings. It is written up in the report instead.

THE PAGE IS THE ARTWORK AND NOTHING ELSE. No margins, no white page behind it:
the MediaBox is exactly the lockup's own size in points, which is what the
existing files do (331.5075 x 418.7025 for a 442.01 x 558.27 drawing, the px to
pt ratio at 96dpi).

TRANSPARENCY SURVIVES. drawImage with mask='auto' carries the alpha channel
through as a soft mask, so the PDF has no white box around the mark.
"""

import sys

from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def main() -> int:
    if len(sys.argv) != 5:
        print(__doc__)
        return 2

    src, out, w, h = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])

    c = canvas.Canvas(out, pagesize=(w, h))
    c.drawImage(ImageReader(src), 0, 0, width=w, height=h, mask='auto')
    c.showPage()
    c.save()

    print(f"  pdf {w:.4f} x {h:.4f} pt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
