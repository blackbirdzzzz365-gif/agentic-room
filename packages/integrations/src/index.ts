import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { sha256Hex } from "@agentic-room/ledger";

export type SignedPayload = {
  keyId: string;
  algorithm: "ed25519";
  payloadHash: string;
  signature: string;
  signedAt: string;
};

type SignedSettlementInput = {
  roomId: string;
  proposalId: string;
  allocations: Record<string, number>;
};

function buildKeyMaterial() {
  const configured = process.env.SIGNER_PRIVATE_KEY?.trim();
  if (configured) {
    const privateKey = createPrivateKey(configured);
    return { privateKey, publicKey: createPublicKey(privateKey) };
  }

  return generateKeyPairSync("ed25519");
}

const keyMaterial = buildKeyMaterial();

export function signAllocationPayload(payload: string): SignedPayload {
  const payloadHash = sha256Hex(payload);
  const signature = sign(null, Buffer.from(payload), keyMaterial.privateKey).toString("base64");

  return {
    keyId: process.env.SIGNER_KEY_ID ?? "dev-ed25519",
    algorithm: "ed25519",
    payloadHash,
    signature,
    signedAt: new Date().toISOString()
  };
}

export function signSettlementPayload(input: SignedSettlementInput) {
  return {
    ...signAllocationPayload(JSON.stringify(input)),
    payload: input
  };
}

export function buildPaymentHandoff(input: SignedSettlementInput) {
  return {
    adapterMode: process.env.PAYMENT_ADAPTER_MODE ?? "stub",
    emittedAt: new Date().toISOString(),
    proposalId: input.proposalId,
    roomId: input.roomId,
    allocations: input.allocations
  };
}
