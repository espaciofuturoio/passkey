"use server";

import type {
	AuthenticationResponseJSON,
	GenerateAuthenticationOptionsOpts,
	GenerateRegistrationOptionsOpts,
	RegistrationResponseJSON,
	VerifyAuthenticationResponseOpts,
	VerifyRegistrationResponseOpts,
	WebAuthnCredential,
} from "@simplewebauthn/server";

import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from "@simplewebauthn/server";

import {
	deleteChallenge,
	getChallenge,
	getUser,
	saveUser,
	storeChallenge,
} from "@/app/libs/redis";
import { ENV } from "@/app/libs/env";
import { ErrorCode, InAppError } from "@/app/libs/errors";

/**
 * Retrieves the RP ID corresponding to the provided host.
 *
 * @param host - The host for which to retrieve the RP ID.
 * @returns The matching RP ID.
 * @throws Error if no matching RP ID is found.
 */
const getRpInfo = (origin: string): { rpName: string; rpId: string } => {
	const index = ENV.EXPECTED_ORIGIN.findIndex(
		(expectedOrigin) => origin === expectedOrigin,
	);
	if (index !== -1)
		return { rpName: ENV.RP_NAME[index], rpId: ENV.RP_ID[index] };
	throw new InAppError(ErrorCode.NO_MATCHING_RP_ID);
};

export const getRegistrationOptions = async ({
	identifier,
	origin,
}: {
	identifier: string;
	origin: string;
}) => {
	const rpInfo = getRpInfo(origin);
	const userResponse = await getUser({
		rpId: rpInfo.rpId,
		identifier,
	});
	if (!userResponse) throw new InAppError(ErrorCode.UNEXPECTED_ERROR);
	const { credentials } = userResponse;
	const opts: GenerateRegistrationOptionsOpts = {
		rpName: rpInfo.rpName,
		rpID: rpInfo.rpId,
		userName: identifier,
		timeout: ENV.CHALLENGE_TTL_MS,
		attestationType: "none",
		/**
		 * Passing in a user's list of already-registered credential IDs here prevents users from
		 * registering the same authenticator multiple times. The authenticator will simply throw an
		 * error in the browser if it's asked to perform registration when it recognizes one of the
		 * credential ID's.
		 */
		excludeCredentials: credentials.map((cred) => ({
			id: cred.id,
			type: "public-key",
			transports: cred.transports,
		})),
		authenticatorSelection: {
			residentKey: "discouraged",
			/**
			 * https://passkeys.dev/docs/use-cases/bootstrapping/#a-note-about-user-verification
			 */
			userVerification: "preferred",
		},
		/**
		 * Support the two most common algorithms: ES256
		 */
		supportedAlgorithmIDs: [-7],
	};
	const options = await generateRegistrationOptions(opts);
	const challengeKey = getChallengeKey(identifier, rpInfo.rpId);
	await storeChallenge(challengeKey, options.challenge);
	console.log("options --->", options);
	return options;
};

export const verifyRegistration = async ({
	identifier,
	registrationResponse,
	origin,
}: {
	identifier: string;
	registrationResponse: RegistrationResponseJSON;
	origin: string;
}) => {
	const rpInfo = getRpInfo(origin);
	const expectedChallenge = await getChallenge(identifier);
	if (!expectedChallenge) throw new InAppError(ErrorCode.CHALLENGE_NOT_FOUND);

	const userResponse = await getUser({
		rpId: rpInfo.rpId,
		identifier,
	});
	if (!userResponse) throw new InAppError(ErrorCode.UNEXPECTED_ERROR);
	const { credentials } = userResponse;

	const opts: VerifyRegistrationResponseOpts = {
		response: registrationResponse,
		expectedChallenge,
		expectedOrigin: rpInfo.rpId,
		expectedRPID: rpInfo.rpId,
		requireUserVerification: false,
	};
	const { verified, registrationInfo } = await verifyRegistrationResponse(opts);

	if (verified && registrationInfo) {
		const { credential } = registrationInfo;

		const existingCredential = credentials.find(
			(cred) => cred.id === credential.id,
		);

		if (!existingCredential) {
			/**
			 * Add the returned credential to the user's list of credentials
			 */
			const newCredential: WebAuthnCredential = {
				id: credential.id,
				publicKey: credential.publicKey,
				counter: credential.counter,
				transports: registrationResponse.response.transports,
			};
			await saveUser({
				rpId: rpInfo.rpId,
				identifier,
				user: {
					credentials: [...credentials, newCredential],
				},
			});
		}
	}

	await deleteChallenge(identifier);
	return { verified };
};

const getChallengeKey = (identifier: string, rpId: string) => {
	return `${identifier}:${rpId}`;
};

export const getAuthenticationOptions = async ({
	identifier,
	origin,
}: {
	identifier: string;
	origin: string;
}) => {
	const rpInfo = getRpInfo(origin);
	const userResponse = await getUser({
		rpId: rpInfo.rpId,
		identifier,
	});
	if (!userResponse) throw new InAppError(ErrorCode.UNEXPECTED_ERROR);
	const { credentials } = userResponse;

	const opts: GenerateAuthenticationOptionsOpts = {
		timeout: ENV.CHALLENGE_TTL_MS,
		allowCredentials: credentials.map((cred) => ({
			id: cred.id,
			type: "public-key",
			transports: cred.transports,
		})),
		userVerification: "preferred",
		rpID: rpInfo.rpId,
	};

	const options = await generateAuthenticationOptions(opts);
	const challengeKey = getChallengeKey(identifier, rpInfo.rpId);
	await Promise.all([storeChallenge(challengeKey, options.challenge)]);
	return options;
};

export const verifyAuthentication = async ({
	identifier,
	authenticationResponse,
	origin,
}: {
	identifier: string;
	authenticationResponse: AuthenticationResponseJSON;
	origin: string;
}) => {
	const rpInfo = getRpInfo(origin);
	const challengeKey = getChallengeKey(identifier, rpInfo.rpId);
	const expectedChallenge = await getChallenge(challengeKey);
	if (!expectedChallenge) throw new InAppError(ErrorCode.CHALLENGE_NOT_FOUND);

	const userResponse = await getUser({
		rpId: rpInfo.rpId,
		identifier,
	});
	if (!userResponse) throw new InAppError(ErrorCode.UNEXPECTED_ERROR);
	const { credentials } = userResponse;

	// Find the credential in the user's list of credentials
	const dbCredentialIndex = credentials.findIndex(
		(cred) => cred.id === authenticationResponse.id,
	);
	if (dbCredentialIndex === -1)
		throw new InAppError(ErrorCode.AUTHENTICATOR_NOT_REGISTERED);
	const dbCredential = credentials[dbCredentialIndex];

	const opts: VerifyAuthenticationResponseOpts = {
		response: authenticationResponse,
		expectedChallenge,
		expectedOrigin: rpInfo.rpId,
		expectedRPID: rpInfo.rpId,
		credential: dbCredential,
		requireUserVerification: false,
	};
	const { verified, authenticationInfo } =
		await verifyAuthenticationResponse(opts);

	if (verified) {
		// Update the credential's counter in the DB to the newest count in the authentication
		credentials[dbCredentialIndex].counter = authenticationInfo.newCounter;
		await saveUser({
			rpId: rpInfo.rpId,
			identifier,
			user: {
				credentials,
			},
		});
	}

	await deleteChallenge(challengeKey);

	return { verified };
};
