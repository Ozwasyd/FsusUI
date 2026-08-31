using System.Globalization;
using System.Text;

internal static class AotWebViewPdfDocument
{
  public static byte[] Create()
  {
    const string content = "/H1 <</MCID 0>> BDC BT /F1 24 Tf 72 720 Td (AOT) Tj ET EMC\n";
    var objects = new string[10];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R /StructTreeRoot 7 0 R /MarkInfo << /Marked true >> /Outlines 6 0 R /PageMode /UseOutlines /Names << /Dests 9 0 R >> >>";
    objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R /StructParents 0 >>";
    objects[4] = $"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}endstream";
    objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[6] = "<< /Type /Outlines /First 8 0 R /Last 8 0 R /Count 1 >>";
    objects[7] = "<< /Type /StructTreeRoot /K [8 0 R] /ParentTree << /Nums [0 [8 0 R]] >> /ParentTreeNextKey 1 >>";
    objects[8] = "<< /Type /StructElem /S /H1 /P 7 0 R /Pg 3 0 R /K 0 /T (AOT) /Title (AOT) /Parent 6 0 R /Dest (heading-aot) >>";
    objects[9] = "<< /Names [(heading-aot) [3 0 R /XYZ 72 720 0]] >>";

    var builder = new StringBuilder("%PDF-1.7\n%PDF-AOT\n");
    var offsets = new int[objects.Length];
    for (var index = 1; index < objects.Length; index++)
    {
      offsets[index] = Encoding.ASCII.GetByteCount(builder.ToString());
      builder.Append(index).Append(" 0 obj\n")
        .Append(objects[index]).Append("\nendobj\n");
    }

    var xrefOffset = Encoding.ASCII.GetByteCount(builder.ToString());
    builder.Append("xref\n0 ").Append(objects.Length).Append("\n")
      .Append("0000000000 65535 f \n");
    for (var index = 1; index < objects.Length; index++)
    {
      builder.Append(offsets[index].ToString("D10", CultureInfo.InvariantCulture))
        .Append(" 00000 n \n");
    }
    builder.Append("trailer\n<< /Size ").Append(objects.Length)
      .Append(" /Root 1 0 R >>\nstartxref\n")
      .Append(xrefOffset).Append("\n%%EOF\n");
    return Encoding.ASCII.GetBytes(builder.ToString());
  }
}
