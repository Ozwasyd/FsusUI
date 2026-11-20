using System.Runtime.CompilerServices;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Headless.XUnit;
using Avalonia.Rendering.Composition;
using Avalonia.Threading;
using Avalonia.VisualTree;
using FsusUI.Avalonia.Controls;

namespace FsusUI.Avalonia.HeadlessTests;

public class FsusTreePresentationLifetimeHeadlessTests
{
  [AvaloniaFact]
  public async Task ExternalNodeDoesNotRetainDetachedTree()
  {
    var node = new FsusTreeNode("shared", "Before");
    var host = new Grid();
    var window = new Window { Content = host };
    window.Show();
    try
    {
      var detached = await MountAndDetachAsync(window, host, node);
      var live = CreateTree(node);
      host.Children.Add(live);
      Dispatcher.UIThread.RunJobs();

      AssertCollected(detached);
      node.Label = "After";
      Assert.Equal("After", GetLabel(live));
      GC.KeepAlive(node);
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void ExternalNodeDoesNotRetainNeverHostedTree()
  {
    var node = new FsusTreeNode("node", "External");
    AssertCollected(CreateNeverHostedTreeReference(node));
    GC.KeepAlive(node);
  }

  [AvaloniaFact]
  public void LiveTreeReceivesPresentationNotificationsBeforeAttachWhileDetachedAndAfterReattach()
  {
    var node = new FsusTreeNode("node", "Before");
    var tree = CreateTree(node);
    node.Label = "Unhosted";
    Assert.Equal("Unhosted", GetLabel(tree));

    var host = new Grid { Children = { tree } };
    var window = new Window { Content = host };
    window.Show();
    try
    {
      host.Children.Remove(tree);
      Dispatcher.UIThread.RunJobs();
      node.Label = "Detached";
      Assert.Equal("Detached", GetLabel(tree));

      host.Children.Add(tree);
      Dispatcher.UIThread.RunJobs();
      node.Label = "Reattached";
      Assert.Equal("Reattached", GetLabel(tree));
    }
    finally
    {
      window.Close();
    }
  }

  [AvaloniaFact]
  public void QueuedInvalidationDoesNotRebuildReplacementWithTheSameKey()
  {
    var node = new FsusTreeNode("node", "Original");
    var tree = CreateTree(node);
    SetLabelOffDispatcher(node, "Queued");

    var replacement = new FsusTreeNode("node", "Replacement");
    tree.Nodes[0] = replacement;
    tree.RefreshView();
    var content = GetRow(tree).Child;
    Dispatcher.UIThread.RunJobs();

    Assert.Same(content, GetRow(tree).Child);
    Assert.Equal("Replacement", GetLabel(tree));

    node.Label = "No longer subscribed";
    Assert.Same(content, GetRow(tree).Child);
    SetLabelOffDispatcher(replacement, "Still subscribed");
    Dispatcher.UIThread.RunJobs();
    Assert.Equal("Still subscribed", GetLabel(tree));
  }

  private static void SetLabelOffDispatcher(FsusTreeNode node, string label)
  {
    Exception? failure = null;
    var thread = new Thread(() =>
    {
      try
      {
        node.Label = label;
      }
      catch (Exception error)
      {
        failure = error;
      }
    }) { IsBackground = true };
    thread.Start();
    Assert.True(thread.Join(TimeSpan.FromSeconds(5)));
    Assert.Null(failure);
  }

  [MethodImpl(MethodImplOptions.NoInlining)]
  private static async Task<WeakReference> MountAndDetachAsync(Window window, Grid host, FsusTreeNode node)
  {
    var compositor = ElementComposition.GetElementVisual(window)?.Compositor
      ?? throw new InvalidOperationException("The mounted tree lifetime test requires a compositor.");
    FsusTree? tree = CreateTree(node);
    var reference = new WeakReference(tree);
    host.Children.Add(tree);
    window.UpdateLayout();
    Assert.True(tree.IsAttachedToVisualTree());
    Assert.True(tree.Bounds.Width > 0 && tree.Bounds.Height > 0);
    await CommitAsync(compositor);

    Assert.True(host.Children.Remove(tree));
    Assert.Null(tree.Parent);
    Assert.False(tree.IsAttachedToVisualTree());
    tree = null;
    window.UpdateLayout();
    await CommitAsync(compositor);
    return reference;
  }

  private static async Task CommitAsync(Compositor compositor)
  {
    // A dispatcher drain alone does not release the renderer's queued dirty visuals.
    var commit = compositor.RequestCommitAsync();
    Dispatcher.UIThread.RunJobs();
    AvaloniaHeadlessPlatform.ForceRenderTimerTick();
    await commit.WaitAsync(TimeSpan.FromSeconds(5));
  }

  [MethodImpl(MethodImplOptions.NoInlining)]
  private static WeakReference CreateNeverHostedTreeReference(FsusTreeNode node) =>
    new(CreateTree(node));

  private static void AssertCollected(WeakReference reference)
  {
    for (var attempt = 0; attempt < 3 && reference.IsAlive; attempt++)
    {
      GC.Collect();
      GC.WaitForPendingFinalizers();
      GC.Collect();
    }

    Assert.False(reference.IsAlive);
  }

  private static FsusTree CreateTree(FsusTreeNode node)
  {
    var tree = new FsusTree();
    tree.Nodes.Add(node);
    tree.RefreshView();
    return tree;
  }

  private static Border GetRow(FsusTree tree) =>
    Assert.IsType<Border>(Assert.Single(Assert.IsType<StackPanel>(tree.Content).Children));

  private static string? GetLabel(FsusTree tree) => Assert.IsAssignableFrom<TextBlock>(GetRow(tree).Child).Text?.TrimStart();
}
