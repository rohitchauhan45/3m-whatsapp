import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

type RequestContextStore = Map<string, string>;

const requestContextStore =
  new AsyncLocalStorage<RequestContextStore>();
const REQUEST_ID_HEADER_NAME = "x-request-id";

const generateRequestId = (): string => randomUUID();

const addRequestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const existingRequestIdHeader = req.headers[REQUEST_ID_HEADER_NAME];
  const existingRequestId = Array.isArray(existingRequestIdHeader)
    ? existingRequestIdHeader[0]
    : existingRequestIdHeader;
  const requestId = existingRequestId || generateRequestId();

  res.setHeader(REQUEST_ID_HEADER_NAME, requestId);

  requestContextStore.run(new Map(), () => {
    requestContextStore.getStore()?.set("requestId", requestId);
    next();
  });
};

// Accessing the request ID in subsequent middleware or routes
const retrieveRequestId = (): string | undefined =>
  requestContextStore.getStore()?.get("requestId");

export { addRequestIdMiddleware, retrieveRequestId };
