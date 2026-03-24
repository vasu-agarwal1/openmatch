/**
 * POST /api/bookmarks   — toggle a bookmark (save or remove)
 * GET  /api/bookmarks   — list all bookmarks for the current user
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db/mongoose";
import Bookmark from "@/models/Bookmark";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await connectDB();
  const bookmarks = await Bookmark.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return new Response(JSON.stringify({ bookmarks }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { issue, score, reason, guide } = body;

  if (!issue?.url) {
    return new Response(JSON.stringify({ error: "Missing issue data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await connectDB();

  // Toggle: if bookmark exists, remove it; otherwise create it
  const existing = await Bookmark.findOne({
    userId: session.user.id,
    issueUrl: issue.url,
  });

  if (existing) {
    await Bookmark.deleteOne({ _id: existing._id });
    return new Response(
      JSON.stringify({ bookmarked: false, issueUrl: issue.url }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  await Bookmark.create({
    userId: session.user.id,
    issueUrl: issue.url,
    issue,
    score,
    reason,
    guide,
  });

  return new Response(
    JSON.stringify({ bookmarked: true, issueUrl: issue.url }),
    { headers: { "Content-Type": "application/json" } },
  );
}
