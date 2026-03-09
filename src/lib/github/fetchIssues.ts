/**
 * GitHub GraphQL API — fetch a pool of good-first / help-wanted issues.
 *
 * Searches GitHub for open issues labelled "good first issue" or
 * "help wanted" in repositories whose primary language overlaps with
 * the user's top languages.
 *
 * The result is a flat array of issues ready to be embedded & ranked
 * by the Gemini matching service.
 */

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

// ── GraphQL query ────────────────────────────────────────────────────────────

const ISSUES_QUERY = `
query SearchIssues($query: String!, $first: Int!) {
  search(query: $query, type: ISSUE, first: $first) {
    issueCount
    nodes {
      ... on Issue {
        title
        url
        bodyText
        createdAt
        labels(first: 5) { nodes { name } }
        repository {
          nameWithOwner
          url
          stargazerCount
          primaryLanguage { name }
        }
        comments { totalCount }
        reactions { totalCount }
      }
    }
  }
}
`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface GitHubIssue {
  title: string;
  url: string;
  body: string;         // trimmed bodyText
  createdAt: string;
  labels: string[];
  repoName: string;     // "owner/repo"
  repoUrl: string;
  repoStars: number;
  repoLanguage: string;
  commentCount: number;
  reactionCount: number;
}

interface GHSearchResponse {
  data: {
    search: {
      issueCount: number;
      nodes: Array<{
        title: string;
        url: string;
        bodyText: string;
        createdAt: string;
        labels: { nodes: Array<{ name: string }> };
        repository: {
          nameWithOwner: string;
          url: string;
          stargazerCount: number;
          primaryLanguage: { name: string } | null;
        };
        comments: { totalCount: number };
        reactions: { totalCount: number };
      }>;
    };
  };
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Fetch open good-first / help-wanted issues for the given languages.
 *
 * @param accessToken  GitHub OAuth token
 * @param languages    Array of language names (e.g. ["TypeScript", "Python"])
 * @param perLanguage  Max issues per language (default 10)
 */
export async function fetchIssuePool(
  accessToken: string,
  languages: string[],
  perLanguage = 20,
): Promise<GitHubIssue[]> {
  // Take top 5 languages for a wider pool
  const topLangs = languages.slice(0, 5);

  // Only issues created in the last 90 days
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD

  const allIssues: GitHubIssue[] = [];

  for (const lang of topLangs) {
    const searchQ = `label:"good first issue","help wanted" language:${lang} state:open created:>${since} sort:created-desc`;

    const res = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ISSUES_QUERY,
        variables: { query: searchQ, first: perLanguage },
      }),
    });

    if (!res.ok) {
      console.error(`GitHub issue search failed for ${lang}: ${res.status}`);
      continue;
    }

    const json = (await res.json()) as GHSearchResponse;

    for (const node of json.data.search.nodes) {
      // Skip nodes that may not have Issue fields (e.g. empty search results)
      if (!node.title) continue;

      allIssues.push({
        title: node.title,
        url: node.url,
        body: (node.bodyText ?? "").slice(0, 500), // trim for embedding
        createdAt: node.createdAt,
        labels: node.labels.nodes.map((l) => l.name),
        repoName: node.repository.nameWithOwner,
        repoUrl: node.repository.url,
        repoStars: node.repository.stargazerCount,
        repoLanguage: node.repository.primaryLanguage?.name ?? "",
        commentCount: node.comments.totalCount,
        reactionCount: node.reactions.totalCount,
      });
    }
  }

  // Deduplicate by issue URL
  const seen = new Set<string>();
  const unique = allIssues.filter((issue) => {
    if (seen.has(issue.url)) return false;
    seen.add(issue.url);
    return true;
  });

  // Sort newest first
  unique.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return unique;
}
