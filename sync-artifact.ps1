New-Item -ItemType Directory -Force .\app\src\contracts | Out-Null
Copy-Item -Force .\blockchain\build\contracts\FakeNewsVerifier.json .\app\src\contracts\FakeNewsVerifier.json
Write-Host "Artifact copied to app/src/contracts/FakeNewsVerifier.json"
