/**
 * Source of truth for the public AI Ethics page.
 *
 * Update the version and last-updated date when substantive public-facing copy changes.
 */
export const aiEthicsContent = {
  version: "1.0.0",
  lastUpdated: "2026-10-21",
  hero: {
    eyebrow: "Trust, evidence, and accountability",
    title: "How Atlas uses AI and machine learning",
    lead: "One Health Atlas combines trusted public-health evidence, artificial intelligence, and machine learning to help professionals investigate complex disease patterns. Generative AI supports scientific research and evidence exploration. Machine learning helps identify surveillance patterns that may warrant closer examination. Throughout the platform, source transparency, responsible interpretation, and human judgment remain central to how these capabilities are used.",
    note: "Atlas is a decision-support platform. It brings fragmented public-health evidence together so epidemiologists, researchers, and public-health teams can spend less time assembling information and more time on the questions that matter.",
  },
  approach: {
    eyebrow: "Our approach",
    title: "Three ways Atlas uses AI",
    intro:
      "Each capability serves a distinct purpose. Together they help people understand the evidence, find where to look more closely, and take Atlas evidence into the tools they already use.",
  },
  pillars: [
    {
      name: "Generative AI",
      title: "Understand the evidence",
      does: "Ask Atlas is a research assistant that answers questions in plain language using a curated library of peer-reviewed scientific literature. It retrieves the most relevant passages first and then writes an answer grounded in them, with citations to the publications it drew from. When the evidence does not support an answer, Ask Atlas says so rather than guessing.",
      matters:
        "Researchers and public-health staff can explore what the literature says about tick-borne disease, pathogens, and transmission in minutes instead of hours, and can always go to the original source.",
    },
    {
      name: "Machine learning",
      title: "Find patterns worth investigating",
      does: "Atlas applies unsupervised machine learning across all 3,144 U.S. counties to identify surveillance profiles that look unusual compared with similar places. An anomaly-detection model (Isolation Forest) and a statistical reference model work together to produce relative anomaly scores, a review-priority category, and the reasons behind it. A complementary latent-class analysis groups counties into distinct surveillance situations, so each county can be compared with its true peers, its neighbors, and its own history.",
      matters:
        "Investigative time is limited. These models help teams decide where a closer look is most likely to be worthwhile. They identify places to review, not places at risk.",
    },
    {
      name: "AI interoperability",
      title: "Bring evidence into other workflows",
      does: "The Atlas MCP server lets compatible AI assistants and research tools use the Model Context Protocol, an open standard, to look up county profiles, discover indicators, and retrieve evidence provenance directly from Atlas. Access is read-only and limited to published Atlas evidence.",
      matters:
        "Professionals can work with Atlas evidence inside the AI tools they already use, and every result stays attributable to its original source.",
    },
  ],
  otherCapabilitiesIntro: {
    title: "Other intelligent capabilities",
    intro:
      "Not everything intelligent in Atlas is artificial intelligence. Several important capabilities use transparent statistical methods or governed data processes. We describe them as they are.",
  },
  otherCapabilities: [
    {
      term: "Surveillance Gap Score.",
      description:
        "A transparent, reproducible scoring method that highlights where the available surveillance evidence may not match other public evidence for a county. It is a deterministic statistical calculation with published, inspectable rules. It is not a trained machine-learning model, and it does not predict disease.",
    },
    {
      term: "Knowledge graph.",
      description:
        "A connected map of the relationships between pathogens, tick species, places, and scientific publications. It helps researchers explore how evidence connects across sources.",
    },
    {
      term: "Intelligence Feed.",
      description:
        "A curated stream of updates from trusted public-health sources such as the U.S. Centers for Disease Control and Prevention (CDC). Every item keeps its original source and publication details, which reduces the time professionals spend monitoring for new information.",
    },
    {
      term: "Evaluation and monitoring.",
      description:
        "Atlas continuously traces and evaluates its AI systems, including whether answers cite their evidence and whether AI tools are used appropriately, so quality can be measured and improved over time.",
    },
  ],
  architecture: {
    title: "How it fits together",
    intro:
      "Every Atlas capability is built on the same foundation of identifiable, governed evidence.",
    closing:
      "The principle is the same at every layer. AI works from identifiable evidence through controlled interfaces, and scientific interpretation remains with people.",
  },
  architectureLayers: [
    {
      term: "Evidence foundation:",
      description:
        "human disease surveillance, tick surveillance, pathogen data, community context, and scientific literature from public and peer-reviewed sources.",
    },
    {
      term: "Governed data and knowledge:",
      description:
        "a managed data platform, evidence retrieval, the knowledge graph, and source provenance for every record.",
    },
    {
      term: "Analytical and machine-learning models:",
      description:
        "the Surveillance Gap Score, anomaly detection, and county surveillance groupings.",
    },
    {
      term: "Atlas API and MCP server:",
      description:
        "structured, read-only access to approved evidence and analytical results.",
    },
    {
      term: "Where people use it:",
      description:
        "Atlas Web for exploring and comparing counties, Ask Atlas for research questions, and external AI assistants for other workflows.",
    },
  ],
  commitmentsIntro: {
    eyebrow: "Responsible use",
    title: "Our commitments",
  },
  commitments: [
    {
      title: "Evidence first.",
      text: "AI-generated answers are grounded in identified sources and cite them. Analytical results link back to the data and methods behind them.",
    },
    {
      title: "Transparency about methods.",
      text: "We explain which capabilities use AI, which use machine learning, and which use statistical methods, and we publish how our scores are calculated.",
    },
    {
      title: "Decision support, not decisions.",
      text: "Atlas informs professional judgment. It does not make public-health decisions on anyone's behalf.",
    },
    {
      title: "Read-only, attributable access.",
      text: "External AI tools can read published Atlas evidence. They cannot change it, and results stay tied to their sources.",
    },
    {
      title: "Human judgment at the center.",
      text: "People decide what to investigate, how to interpret the evidence, and what action to take.",
    },
  ],
  limitationsIntro: {
    title: "Understanding the limits",
    intro: "Using AI responsibly means being clear about what it cannot do.",
  },
  limitations: [
    "Atlas is not a clinical service. It does not diagnose illness or provide treatment advice.",
    "Machine-learning results show where a closer look may be warranted. They do not predict disease risk for individuals or communities, forecast outbreaks, or establish disease burden.",
    "Atlas does not establish what caused a pattern or outcome.",
    "AI-generated answers can be incomplete or inaccurate. Check the cited sources before relying on an answer.",
    "Results depend on the data available. Surveillance data can be incomplete, delayed, or reported differently across jurisdictions, and Atlas shows when evidence is limited or unavailable.",
  ],
  feedback: {
    title: "Questions and feedback",
    before:
      "If you have a question about how Atlas uses AI, or you see something that looks wrong, use ",
    emphasis: "Feedback",
    between:
      " at the bottom of this page. We review every report. You can also read more about our ",
    links: [
      {
        href: "/docs/releases-and-methodology",
        label: "data and methods",
      },
      {
        href: "/docs/api-mcp-and-access",
        label: "MCP and API access",
      },
      {
        href: "/privacy",
        label: "privacy",
      },
    ],
  },
} as const;
