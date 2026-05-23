@echo off
REM ============================================
REM shared 一键构建 & 同步到客户端 + 服务端
REM 用法：build-shared.bat
REM ============================================

set ROOT=%~dp0
set SHARED=%ROOT%shared
set CLIENT_ASSETS=%ROOT%RoguelikeClient\assets\shared
set SERVER_SHARED=%ROOT%server\src\shared

echo [1/4] 编译 shared (ESM + CJS)...
cd /d "%SHARED%"
call npx tsc -p tsconfig.esm.json
if %errorlevel% neq 0 (echo ❌ ESM 编译失败 & exit /b 1)
call npx tsc -p tsconfig.cjs.json
if %errorlevel% neq 0 (echo ❌ CJS 编译失败 & exit /b 1)
node -e "require('fs').writeFileSync('dist/cjs/package.json', JSON.stringify({type:'commonjs'},null,2))"
echo ✅ 编译完成

echo [2/4] 同步到客户端 (assets/shared/)...
if not exist "%CLIENT_ASSETS%" mkdir "%CLIENT_ASSETS%"
xcopy "%SHARED%\dist\esm\*" "%CLIENT_ASSETS%\" /E /Y /I /Q
echo ✅ 客户端 ESM 同步完成

echo [3/4] 同步到服务端 (server/src/shared/)...
if not exist "%SERVER_SHARED%" mkdir "%SERVER_SHARED%"
xcopy "%SHARED%\dist\cjs\*" "%SERVER_SHARED%\" /E /Y /I /Q
echo ✅ 服务端 CJS 同步完成

echo [4/4] 同步到桌面 Cocos 项目...
if exist "D:\wb.jiwenpeng01\Desktop\cs\code\RoguelikeClient\assets\shared" (
    xcopy "%SHARED%\dist\esm\*" "D:\wb.jiwenpeng01\Desktop\cs\code\RoguelikeClient\assets\shared\" /E /Y /I /Q
    echo ✅ 桌面 Cocos 项目同步完成
) else (
    echo ⚠ 桌面 Cocos 项目不存在，跳过
)

echo.
echo ✅ 全部完成！修改 shared/src/*.ts 后运行此脚本即可同步三端。
