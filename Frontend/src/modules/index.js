import { itgcPasswordModule, comingSoonModules } from "./itgc-password/config.jsx";
import { itgcChangeModule } from "./itgc-change/config.jsx";
import { nfsVendorBankModule } from "./nfs-vendor-bank/config.jsx";

export const MODULES = [
  itgcChangeModule,
  itgcPasswordModule,
  nfsVendorBankModule,
  ...comingSoonModules.filter((m) => m.id !== "itgc-change"),
];
