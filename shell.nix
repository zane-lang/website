{
  pkgs ? import <nixpkgs> { },
}:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs
  ];

  shellHook = ''
    echo "Env is ready !"
    echo "npm: "
    npm --version
  '';
}
