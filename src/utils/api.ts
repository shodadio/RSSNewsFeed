/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Headers for our own JSON APIs.
 *
 * The app used to attach a session passcode token here. The passcode gate is gone
 * (single-user reader), so this is purely the content-type header the server's
 * express.json() parser expects.
 */
export function getJsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}
