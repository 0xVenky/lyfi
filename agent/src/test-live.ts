import "dotenv/config";
import { printWalletStatus, getWalletAddress } from "./executor.js";

console.log("Address:", getWalletAddress());
printWalletStatus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
