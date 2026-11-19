using System.Text.Json;
using Microsoft.Diagnostics.Tracing;
using Microsoft.Diagnostics.Tracing.Parsers;

if (args.Length != 1)
    throw new ArgumentException("Usage: Decoder <trace.nettrace>");

using var source = new EventPipeEventSource(args[0]);
void Emit(TraceEvent ev)
{
    var payload = new Dictionary<string, object?>();
    for (var i = 0; i < ev.PayloadNames.Length; i++)
    {
        var value = ev.PayloadValue(i);
        payload[ev.PayloadNames[i]] = value is string or bool or int or uint or long or ulong or double
            ? value : Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture);
    }
    Console.WriteLine(JsonSerializer.Serialize(new { provider = ev.ProviderName, name = ev.EventName,
        ms = ev.TimeStampRelativeMSec, pid = ev.ProcessID, tid = ev.ThreadID, payload }));
}

source.Clr.All += ev =>
{
    if (ev.EventName.StartsWith("GC/", StringComparison.Ordinal))
        Emit(ev);
};
source.Dynamic.All += ev =>
{
    if (ev.ProviderName == "FsusUI-RenderPhases")
        Emit(ev);
};
source.Process();
Console.WriteLine(JsonSerializer.Serialize(new { eventsLost = source.EventsLost }));
return source.EventsLost == 0 ? 0 : 1;
