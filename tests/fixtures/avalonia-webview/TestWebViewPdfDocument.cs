using System.Text;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.TestFixtures;

internal static class TestWebViewPdfDocument
{
  internal static IReadOnlyList<FsusWebViewDocumentOutlineNode> CreateOutline() =>
  [
    new FsusWebViewDocumentOutlineNode
    {
      Title = "Article",
      HeadingLevel = 1,
      Destination = "heading-article",
      Children =
      [
        new FsusWebViewDocumentOutlineNode
        {
          Title = "Methods",
          HeadingLevel = 2,
          Destination = "heading-methods",
          Children =
          [
            new FsusWebViewDocumentOutlineNode
            {
              Title = "Inputs",
              HeadingLevel = 3,
              Destination = "heading-inputs",
            },
          ],
        },
        new FsusWebViewDocumentOutlineNode
        {
          Title = "Results",
          HeadingLevel = 2,
          Destination = "heading-results",
        },
      ],
    },
  ];

  internal static byte[] Create(
    bool dark,
    bool tagged = true,
    bool outline = true,
    bool omitLastDestination = false)
  {
    var background = dark ? "0.071 0.071 0.078" : "1 1 1";
    var foreground = dark ? "0.941 0.941 0.957" : "0.059 0.059 0.067";
    var pageOne = $"q {background} rg 0 0 612 792 re f Q\n" +
      $"{foreground} rg\n" +
      "/H1 <</MCID 0>> BDC BT /F1 24 Tf 72 720 Td (Article) Tj ET EMC\n" +
      "/H2 <</MCID 1>> BDC BT /F1 22 Tf 72 624 Td (Methods) Tj ET EMC\n" +
      "/H3 <</MCID 2>> BDC BT /F1 20 Tf 72 528 Td (Inputs) Tj ET EMC\n";
    var pageTwo = $"q {background} rg 0 0 612 792 re f Q\n" +
      $"{foreground} rg\n" +
      "/H2 <</MCID 0>> BDC BT /F1 22 Tf 72 720 Td (Results) Tj ET EMC\n";
    var catalogExtras = string.Concat(
      tagged ? " /StructTreeRoot 12 0 R /MarkInfo << /Marked true >>" : string.Empty,
      outline ? " /Outlines 7 0 R /PageMode /UseOutlines /Names << /Dests 13 0 R >>" : string.Empty);
    var objects = new string[20];
    objects[1] = $"<< /Type /Catalog /Pages 2 0 R{catalogExtras} >>";
    objects[2] = "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>";
    objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 5 0 R /StructParents 0 >>";
    objects[4] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 18 0 R /StructParents 1 >>";
    objects[5] = StreamObject(pageOne);
    objects[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[7] = "<< /Type /Outlines /First 8 0 R /Last 8 0 R /Count 4 >>";
    objects[8] = "<< /Title (Article) /Parent 7 0 R /First 9 0 R /Last 11 0 R /Count 3 /Dest (heading-article) >>";
    objects[9] = "<< /Title (Methods) /Parent 8 0 R /First 10 0 R /Last 10 0 R /Count 1 /Next 11 0 R /Dest (heading-methods) >>";
    objects[10] = "<< /Title (Inputs) /Parent 9 0 R /Dest (heading-inputs) >>";
    objects[11] = omitLastDestination
      ? "<< /Title (Results) /Parent 8 0 R /Prev 9 0 R >>"
      : "<< /Title (Results) /Parent 8 0 R /Prev 9 0 R /Dest (heading-results) >>";
    objects[12] = "<< /Type /StructTreeRoot /K [14 0 R 15 0 R 16 0 R 17 0 R] /ParentTree << /Nums [0 [14 0 R 15 0 R 16 0 R] 1 [17 0 R]] >> /ParentTreeNextKey 2 >>";
    objects[13] = "<< /Names [(heading-article) [3 0 R /XYZ 72 720 0] (heading-methods) [3 0 R /XYZ 72 624 0] (heading-inputs) [3 0 R /XYZ 72 528 0] " +
      (omitLastDestination ? string.Empty : "(heading-results) [4 0 R /XYZ 72 720 0] ") + "] >>";
    objects[14] = "<< /Type /StructElem /S /H1 /P 12 0 R /Pg 3 0 R /K 0 /T (Article) >>";
    objects[15] = "<< /Type /StructElem /S /H2 /P 14 0 R /Pg 3 0 R /K 1 /T (Methods) >>";
    objects[16] = "<< /Type /StructElem /S /H3 /P 15 0 R /Pg 3 0 R /K 2 /T (Inputs) >>";
    objects[17] = "<< /Type /StructElem /S /H2 /P 14 0 R /Pg 4 0 R /K 0 /T (Results) >>";
    objects[18] = StreamObject(pageTwo);
    objects[19] = $"<< /Producer (FsusUI deterministic WebView backend simulation) /PageBackground ({(dark ? "#121214" : "#FFFFFF")}) /TextColor ({(dark ? "#F0F0F4" : "#0F0F11")}) /PrintBackgrounds true >>";

    var builder = new StringBuilder("%PDF-1.7\n%\0PDF-BINARY\n");
    var offsets = new int[objects.Length];
    for (var index = 1; index < objects.Length; index++)
    {
      offsets[index] = Encoding.ASCII.GetByteCount(builder.ToString());
      builder.Append(index).Append(" 0 obj\n")
        .Append(objects[index]).Append("\nendobj\n");
    }

    var xrefOffset = Encoding.ASCII.GetByteCount(builder.ToString());
    builder.Append("xref\n0 ").Append(objects.Length).Append("\n")
      .Append("0000000000 65535 f\r\n");
    for (var index = 1; index < objects.Length; index++)
    {
      builder.Append(offsets[index].ToString("D10", System.Globalization.CultureInfo.InvariantCulture))
        .Append(" 00000 n\r\n");
    }
    builder.Append("trailer\n<< /Size ").Append(objects.Length)
      .Append(" /Root 1 0 R /Info 19 0 R >>\nstartxref\n")
      .Append(xrefOffset).Append("\n%%EOF\n");
    return Encoding.ASCII.GetBytes(builder.ToString());
  }

  private static string StreamObject(string content) =>
    $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}endstream";
}
