/**
 * Paperless-ngx REST API version contract.
 *
 * Tagvico pins the API version it was validated against instead of accepting
 * the server default. Paperless-ngx 2.16 through 2.20 default to version 9;
 * Paperless-ngx 3.x defaults to version 10, which paginates the task list,
 * renames task fields, and deprecates the `all` list parameter. Pinning 9
 * keeps document, task, and custom-field payloads identical on both lines.
 * Version 9 requires Paperless-ngx 2.16.0 or newer.
 */
export const PAPERLESS_API_VERSION = '9';
export const PAPERLESS_ACCEPT = `application/json; version=${PAPERLESS_API_VERSION}`;
export const MINIMUM_PAPERLESS_VERSION = '2.16.0';
