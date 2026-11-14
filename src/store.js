// Margin first version: a sponsored-line store with review status.
// Follows SPEC.md: a line always carries the label "Sponsored", one line per
// answer, and only approved lines may be served. No reader identity is stored.
"use strict";

const VALID_STATUSES = ["pending", "approved", "rejected"];

class Store {
  constructor() {
    this.lines = new Map(); // line id -> line object
    this.nextId = 1;
  }

  // Submit a line for review. Returns the stored line (status "pending").
  // Throws on a missing field or a line that would hide its label.
  submitLine({ slotId, text, link, sponsor }) {
    if (!slotId || !text || !link || !sponsor) {
      throw new Error("slotId, text, link and sponsor are all required");
    }
    const line = {
      id: String(this.nextId++),
      slotId,
      label: "Sponsored",
      text,
      link,
      sponsor,
      reviewStatus: "pending",
      reviewReason: null,
    };
    this.lines.set(line.id, line);
    return { ...line };
  }

  // Review a pending line. status must be "approved" or "rejected".
  // A rejected line carries a reason and can be resubmitted as a new line.
  // Any edit to a live line goes back through review: see updateLine.
  reviewLine(id, status, reason = null) {
    const line = this.lines.get(String(id));
    if (!line) throw new Error(`no line with id ${id}`);
    if (status !== "approved" && status !== "rejected") {
      throw new Error('review status must be "approved" or "rejected"');
    }
    if (status === "rejected" && !reason) {
      throw new Error("a rejected line needs a reason");
    }
    line.reviewStatus = status;
    line.reviewReason = status === "rejected" ? reason : null;
    return { ...line };
  }

  // Edit a line's creative. An edit sends it back to "pending" review
  // before it can run again (SPEC.md review flow, step 4).
  updateLine(id, { text, link, sponsor }) {
    const line = this.lines.get(String(id));
    if (!line) throw new Error(`no line with id ${id}`);
    if (text !== undefined) line.text = text;
    if (link !== undefined) line.link = link;
    if (sponsor !== undefined) line.sponsor = sponsor;
    line.reviewStatus = "pending";
    line.reviewReason = null;
    return { ...line };
  }

  getLine(id) {
    const line = this.lines.get(String(id));
    return line ? { ...line } : null;
  }

  listLines(status = null) {
    const all = [...this.lines.values()].map((l) => ({ ...l }));
    if (status) {
      if (!VALID_STATUSES.includes(status)) throw new Error(`unknown status ${status}`);
      return all.filter((l) => l.reviewStatus === status);
    }
    return all;
  }

  // The serving read: one approved line, or null when none is approved.
  // Deterministic order (lowest id first) so the endpoint is testable.
  getApprovedLine() {
    for (const line of [...this.lines.values()].sort((a, b) => Number(a.id) - Number(b.id))) {
      if (line.reviewStatus === "approved") return { ...line };
    }
    return null;
  }
}

module.exports = { Store };
