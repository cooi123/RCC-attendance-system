/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admins from "../admins.js";
import type * as attendance from "../attendance.js";
import type * as lib_adminSession from "../lib/adminSession.js";
import type * as lib_checkInToken from "../lib/checkInToken.js";
import type * as nodeAuth from "../nodeAuth.js";
import type * as people from "../people.js";
import type * as sessions from "../sessions.js";
import type * as setup from "../setup.js";
import type * as teams from "../teams.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admins: typeof admins;
  attendance: typeof attendance;
  "lib/adminSession": typeof lib_adminSession;
  "lib/checkInToken": typeof lib_checkInToken;
  nodeAuth: typeof nodeAuth;
  people: typeof people;
  sessions: typeof sessions;
  setup: typeof setup;
  teams: typeof teams;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
