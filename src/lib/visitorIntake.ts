/** Labels for checklist ids — ids must match `convex/lib/visitorChecklist.ts`. */
export const VISITOR_CHECKLIST_OPTIONS = [
  { id: "know_jesus", label: "To know more about Jesus" },
  {id: "know_church", label: "To know more about Reach Community Church"},
  {id:"notify_on_events", label: "To be notified of events"},
  {id:"join_bible_study", label: "To join a Bible Study - Select below which group you'd like to join"},
  {id: "youth", label: "Youth (Highschool)"},
  {id:"university", label: "University"},
  {id: "young_adults", label: "Young Adults"},
  {id: "family_north", label: "Family (North)"},
  {id: "family_west", label: "Family (West)"},
  {id: "family_east", label: "Family (East)"},
] as const;

export type VisitorChecklistOptionId = (typeof VISITOR_CHECKLIST_OPTIONS)[number]["id"];
