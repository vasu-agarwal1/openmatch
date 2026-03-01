/**
 * GitHub GraphQL API — fetch a developer's profile data.
 *
 * Uses the OAuth access_token embedded in the user's JWT to query:
 *   • basic profile info (name, bio, avatar, followers)
 *   • top repositories by commit contribution
 *   • language breakdown across all owned repos
 *   • total commits, PRs, and earned stars
 *
 * The result is shaped to match the UserProfile model so it can be
 * upserted directly into MongoDB.
 */

import type { ILanguageStat, ITopRepo } from "@/models/UserProfile";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

// ── GraphQL query ────────────────────────────────────────────────────────────

const USER_PROFILE_QUERY = `
query UserProfile($login: String!) {
  user(login: $login) {
    name
    login
    avatarUrl
    bio
    followers { totalCount }

    # contribution stats
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
    }

    # top repos by stars (owned only)
    repositories(
      first: 10
      ownerAffiliations: OWNER
      orderBy: { field: STARGAZERS, direction: DESC }
      isFork: false
    ) {
      nodes {
        nameWithOwner
        description
        url
        stargazerCount
        primaryLanguage { name }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 0) { totalCount }
            }
          }
        }
      }
    }

    # language byte-counts across all owned repos (top 20 repos)
    languageRepos: repositories(
      first: 20
      ownerAffiliations: OWNER
      orderBy: { field: PUSHED_AT, direction: DESC }
      isFork: false
    ) {
      nodes {
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges {
            size
            node { name }
          }
        }
      }
    }
  }
}
`;

// ── Types for the raw GraphQL response ───────────────────────────────────────

interface GHRepoNode {
  nameWithOwner: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
  defaultBranchRef: {
    target: {
      history: { totalCount: number };
    };
  } | null;
}

interface GHLanguageEdge {
  size: number;
  node: { name: string };
}

interface GHUserResponse {
  data: {
    user: {
      name: string | null;
      login: string;
      avatarUrl: string;
      bio: string | null;
      followers: { totalCount: number };
      contributionsCollection: {
        totalCommitContributions: number;
        totalPullRequestContributions: number;
      };
      repositories: { nodes: GHRepoNode[] };
      languageRepos: {
        nodes: Array<{
          languages: { edges: GHLanguageEdge[] };
        }>;
      };
    };
  };
}

// ── Public interface ─────────────────────────────────────────────────────────

export interface GitHubProfileData {
  githubLogin: string;
  name: string;
  avatarUrl: string;
  bio: string;
  followers: number;
  totalCommits: number;
  totalPRs: number;
  totalStars: number;
  languages: ILanguageStat[];
  topRepos: ITopRepo[];
  experienceLevel: "beginner" | "intermediate" | "advanced";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function aggregateLanguages(
  repos: GHUserResponse["data"]["user"]["languageRepos"]["nodes"],
): ILanguageStat[] {
  const map = new Map<string, number>();

  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      map.set(edge.node.name, (map.get(edge.node.name) ?? 0) + edge.size);
    }
  }

  const totalBytes = [...map.values()].reduce((a, b) => a + b, 0);
  if (totalBytes === 0) return [];

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: Math.round((bytes / totalBytes) * 1000) / 10,
    }));
}

function deriveExperienceLevel(
  commits: number,
  prs: number,
): "beginner" | "intermediate" | "advanced" {
  const score = commits + prs * 2;
  if (score >= 500) return "advanced";
  if (score >= 100) return "intermediate";
  return "beginner";
}

// ── Main fetch function ──────────────────────────────────────────────────────

export async function fetchGitHubProfile(
  accessToken: string,
  login: string,
): Promise<GitHubProfileData> {
  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: USER_PROFILE_QUERY, variables: { login } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as GHUserResponse;
  const u = json.data.user;

  const totalCommits = u.contributionsCollection.totalCommitContributions;
  const totalPRs = u.contributionsCollection.totalPullRequestContributions;
  const totalStars = u.repositories.nodes.reduce(
    (sum, r) => sum + r.stargazerCount,
    0,
  );

  const topRepos: ITopRepo[] = u.repositories.nodes.map((r) => ({
    name: r.nameWithOwner,
    description: r.description ?? "",
    url: r.url,
    stars: r.stargazerCount,
    primaryLanguage: r.primaryLanguage?.name ?? "",
    commitCount: r.defaultBranchRef?.target?.history?.totalCount ?? 0,
  }));

  const languages = aggregateLanguages(u.languageRepos.nodes);

  return {
    githubLogin: u.login,
    name: u.name ?? u.login,
    avatarUrl: u.avatarUrl,
    bio: u.bio ?? "",
    followers: u.followers.totalCount,
    totalCommits,
    totalPRs,
    totalStars,
    languages,
    topRepos,
    experienceLevel: deriveExperienceLevel(totalCommits, totalPRs),
  };
}
