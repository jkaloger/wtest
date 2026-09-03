{
  description = "Vitest + browser mode + Playwright test harness proving ground";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Chromium only: layers 2 and 3 both drive chromium, nothing else is fetched.
        browsers = pkgs.playwright-driver.browsers.override {
          withChromium = true;
          withFirefox = false;
          withWebkit = false;
          withFfmpeg = false;
        };

        # oxfmt is new; fall back to prettier when the pinned nixpkgs lacks it.
        formatter = pkgs.oxfmt or pkgs.nodePackages.prettier;
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.pnpm
            pkgs.just
            pkgs.process-compose
            pkgs.oxlint
            formatter
            browsers
          ];

          env = {
            PLAYWRIGHT_BROWSERS_PATH = "${browsers}";
            PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
            PLAYWRIGHT_VERSION = pkgs.playwright-driver.version;
            NEXT_TELEMETRY_DISABLED = "1";
            ASTRO_TELEMETRY_DISABLED = "1";
          };

          shellHook = ''
            echo "playwright-driver ${pkgs.playwright-driver.version} | node $(node --version)"
          '';
        };
      }
    );
}
