import type { Abi } from "abitype";

export interface ContractFixture<TAbi extends Abi = Abi> {
	abi: TAbi;
	address?: `0x${string}`;
}
