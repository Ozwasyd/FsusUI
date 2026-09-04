using System.Diagnostics.CodeAnalysis;

public static class Warning
{
  [RequiresUnreferencedCode("Mutation fixture")]
  private static void RequiresPreservedCode()
  {
  }

  public static void Trigger() => RequiresPreservedCode();
}
