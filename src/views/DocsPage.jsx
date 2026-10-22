// Static content; section anchors (/docs#estimates, /docs#accuracy) use native hash scrolling.
export default function DocsPage() {
  return (
    <>
      <h1 className="page-title">How Agent Spend works</h1>
      <p className="lead">
        Agent Spend reads Cursor's data on this machine and never sends it anywhere. Estimated spend uses <strong>input</strong> and{' '}
        <strong>output</strong> token totals priced separately via <a href="/pricing">pricing.json</a>. It is not a Cursor invoice:
        included plan usage is not subtracted, and cache reads/writes are not modelled.
      </p>
      <div className="doc-flow" aria-hidden="true">
        <span>Cursor workspace</span>
        <span className="arrow">→</span>
        <span>Agent chats</span>
        <span className="arrow">→</span>
        <span>Steps</span>
        <span className="arrow">→</span>
        <span>Est. spend</span>
      </div>

      <section className="panel doc-section">
        <div className="doc-kicker">1</div>
        <h2>Cursor workspace</h2>
        <p>A workspace is a folder you opened in Cursor. Agent Spend lists one project card per workspace that has Agent transcripts.</p>
        <p>
          On disk that is <code>~/.cursor/projects/&lt;slug&gt;/agent-transcripts/</code>. The slug is Cursor's encoding of the folder path;
          Agent Spend resolves it back to a real path via <code>workspaceStorage</code> and, failing that, by walking the filesystem.
        </p>
        <p>The home page lists projects with chat count and last activity. Opening a project runs a usage scan automatically.</p>
      </section>

      <section className="panel doc-section">
        <div className="doc-kicker">2</div>
        <h2>Agent chats</h2>
        <p>
          An agent chat is one Agent conversation: one composer id, stored as one <code>.jsonl</code> transcript — the same thing as one Agent
          tab. Subagents spawned from a chat live under its <code>subagents/</code> folder and count as their own chats.
        </p>
        <p>Each agent chat has one default model in Cursor's composer data, but individual steps can name a different model.</p>
      </section>

      <section className="panel doc-section" id="estimates">
        <div className="doc-kicker">3</div>
        <h2>Input and output token estimates</h2>
        <p>
          Agent Spend does <strong>not</strong> call Cursor's billing API. It reads what Cursor already wrote locally: transcripts (to find
          chats) and per-step records in <code>globalStorage/state.vscdb</code>, where each step's text, tool payloads, and optional{' '}
          <code>tokenCount</code> live.
        </p>
        <p>
          For every step we assign <strong>input tokens</strong> (user-side content) and <strong>output tokens</strong> (assistant-side
          content). When Cursor stored <code>tokenCount.inputTokens</code> / <code>outputTokens</code>, those values are used as-is. When they
          are missing or zero — common on agent/tool turns — we approximate <strong>~4 characters per token</strong> from the stored message
          text, thinking, code blocks, and tool args/results. On an agent chat, that stored output sits under each prompt and stays collapsed
          until you expand it.
        </p>
        <p>
          <strong>Estimated spend</strong> = (input tokens × input $/1M) + (output tokens × output $/1M), rolled up by model. A single "total
          tokens" figure is not meaningful for cost, so the UI always shows the two sides.
        </p>
        <p>
          Month and day charts use step timestamps when Cursor stored them, otherwise transcript file dates. A model id with no rate is
          flagged on the project page — its tokens are counted but add $0 until you add a row to pricing.json.
        </p>
      </section>

      <section className="panel doc-section" id="accuracy">
        <div className="doc-kicker">4</div>
        <h2>How close is it to the real bill?</h2>
        <p>
          Close enough to rank chats, models, and days; not close enough to reconcile an invoice. Tool payloads are counted as output, which
          inflates output tokens on heavy tool-use chats, and cache reads (often 90%+ of a long agent session's input) are not visible locally.
        </p>
        <p>
          For ground truth, export the usage CSV from <code>cursor.com/dashboard → Usage</code>. Use Agent Spend to answer "which chat / which
          model / which day" and the CSV to answer "how many dollars".
        </p>
      </section>

      <section className="panel doc-section">
        <div className="doc-kicker">Pricing</div>
        <h2>Token prices</h2>
        <p>
          The <a href="/pricing">Pricing</a> page shows the active table: default rates from agent-spend-cursor-data-access, or your{' '}
          <code>server/pricing.json</code> / <code>AGENT_SPEND_PRICING</code> override. Each model id needs input and output USD per 1M tokens.
        </p>
      </section>
    </>
  )
}
