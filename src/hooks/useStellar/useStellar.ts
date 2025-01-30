import { useEffect, useRef, useState } from "react";
import { Horizon, Keypair } from "@stellar/stellar-sdk";
import { ENV } from "@/app/libs/env";
import type {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { getPublicKeys } from "@/app/libs/stellar";
import { handleDeploy } from "./deploy";

const { HORIZON_URL } = ENV;

const getStoredDeployee = () => {
	return localStorage.getItem("sp:deployee");
};

const setStoredDeployee = (deployee: string) => {
	localStorage.setItem("sp:deployee", deployee);
};

const getStoredBundler = () => {
	return localStorage.getItem("sp:bundler");
};

const setStoredBundler = (bundler: string) => {
	localStorage.setItem("sp:bundler", bundler);
};

const setStoredCredentialId = (credentials: string) => {
	localStorage.setItem("sp:id", credentials);
};

const getStoredCredentialId = () => {
	return localStorage.getItem("sp:id");
};

export const useStellar = () => {
	const [loadingDeployee, setLoadingDeployee] = useState(true);
	const [deployee, setDeployee] = useState<string | null>(null);
	const bundlerKey = useRef<Keypair | null>(null);
	const [loadingRegister, setLoadingRegister] = useState(false);
	const [loadingSign, setLoadingSign] = useState(false);

	const onRegister = async (registerRes: RegistrationResponseJSON) => {
		if (deployee) return;
		try {
			setLoadingRegister(true);
			setStoredCredentialId(registerRes.id);
			const { contractSalt, publicKey } = await getPublicKeys(registerRes);
			if (!bundlerKey.current) throw new Error("Bundler key not found");
			if (!contractSalt || !publicKey) throw new Error("Invalid public keys");
			const deployee = await handleDeploy(
				bundlerKey.current,
				contractSalt,
				publicKey,
			);
			console.log({ deployee });
			setStoredDeployee(deployee);
			setDeployee(deployee);
		} catch (error) {
			console.error(error);
		} finally {
			setLoadingRegister(false);
		}
	};

	const onSign = async (signinRes: AuthenticationResponseJSON) => {
		if (!deployee) return;
		try {
			setLoadingSign(true);
		} catch (error) {
			console.error(error);
		} finally {
			setLoadingSign(false);
		}
	};

	useEffect(() => {
		const init = async () => {
			try {
				console.log("Loading deployee started:", loadingDeployee);
				const storedBundler = getStoredBundler();
				if (storedBundler) {
					bundlerKey.current = Keypair.fromSecret(storedBundler);
				} else {
					bundlerKey.current = Keypair.random();
					setStoredBundler(bundlerKey.current.secret());
					const horizon = new Horizon.Server(HORIZON_URL);
					await horizon.friendbot(bundlerKey.current.publicKey()).call();
				}

				const storedDeployee = getStoredDeployee();
				if (storedDeployee) {
					setDeployee(storedDeployee);
				}

				console.log({
					bundlerKey: bundlerKey.current,
					deployee,
				});
			} catch (error) {
				console.error(error);
			} finally {
				setLoadingDeployee(false);
				console.log("Loading deployee ended:", loadingDeployee);
			}
		};

		init();
	}, []);

	console.log({ deployee, loadingDeployee });

	return {
		onRegister,
		onSign,
		deployee,
		loadingRegister,
		loadingSign,
		loadingDeployee,
	};
};
