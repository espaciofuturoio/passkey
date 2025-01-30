import { useState } from "react";
import {
	type AuthenticationResponseJSON,
	startAuthentication,
} from "@simplewebauthn/browser";
import { toast } from "sonner";
import { ErrorCode } from "@/app/libs/errors";
import { InAppError } from "@/app/libs/errors";

export const usePasskeyAuthentication = (
	identifier: string,
	{ onSign }: { onSign?: (res: AuthenticationResponseJSON) => void },
) => {
	const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
	const [authSuccess, setAuthSuccess] = useState<string>("");
	const [authError, setAuthError] = useState<string>("");

	const reset = () => {
		setIsAuthenticating(false);
		setAuthSuccess("");
		setAuthError("");
	};

	const handleAuth = async () => {
		setIsAuthenticating(true);
		setAuthSuccess("");
		setAuthError("");

		try {
			const resp = await fetch("api/generate-authentication-options", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					identifier,
					origin: window.location.origin,
				}),
			});

			if (!resp.ok) {
				const opts = await resp.json();
				throw new InAppError(ErrorCode.UNEXPECTED_ERROR, opts.error);
			}

			const authenticationOptions = await resp.json();

			console.log("Authentication Options", authenticationOptions);

			const authenticationResponse = await startAuthentication({
				optionsJSON: authenticationOptions,
			});
			console.log("Authentication Response", authenticationResponse);

			const verificationResp = await fetch("api/verify-authentication", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					identifier,
					authenticationResponse,
					origin: window.location.origin,
				}),
			});

			if (!verificationResp.ok) {
				const verificationJSON = await verificationResp.json();
				throw new InAppError(
					ErrorCode.UNEXPECTED_ERROR,
					verificationJSON.error,
				);
			}

			const verificationJSON = await verificationResp.json();
			console.log("Server Response", verificationJSON);

			if (verificationJSON?.verified) {
				const message = "User authenticated!";
				setAuthSuccess(message);
				toast.success(message);
				onSign?.(authenticationResponse);
			} else {
				const message = `Oh no, something went wrong! Response: ${JSON.stringify(verificationJSON)}`;
				setAuthError(message);
				toast.error(message);
			}
		} catch (_error) {
			const error = _error as Error;
			let message = error.toString();
			if (
				error.message.includes(
					"The operation either timed out or was not allowed.",
				)
			) {
				message = "Operation cancelled or not allowed";
			}
			setAuthError(message);
			toast.error(message);
		} finally {
			setIsAuthenticating(false);
		}
	};

	return {
		isAuthenticating,
		authSuccess,
		authError,
		handleAuth,
		isAuthenticated: Boolean(authSuccess),
		reset,
	};
};
