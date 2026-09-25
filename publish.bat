@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Jonesy-Launcher - Publish

rem ===== CONFIG =====
set "REPO=https://github.com/yaya992/Jonesy-Launcher.git"
set "BRANCH=main"
rem ==================

rem --- Couleurs (VT100) ---
for /f %%e in ('echo prompt $E^| cmd') do set "ESC=%%e"
set "C_RESET=%ESC%[0m"
set "C_TITLE=%ESC%[1;36m"
set "C_OK=%ESC%[1;32m"
set "C_WARN=%ESC%[1;33m"
set "C_ERR=%ESC%[1;31m"
set "C_DIM=%ESC%[90m"
set "C_INFO=%ESC%[1;37m"

call :banner

where git >nul 2>&1
if errorlevel 1 (
    call :err "Git est introuvable. Installe-le : https://git-scm.com"
    goto :end
)

rem --- Init auto du depot et du remote ---
if not exist ".git" (
    call :step "Initialisation du depot Git..."
    git init -q
    git branch -M %BRANCH%
)
git remote get-url origin >nul 2>&1 && (
    git remote set-url origin %REPO% >nul
) || (
    git remote add origin %REPO%
)

rem --- .gitignore par defaut ---
if not exist ".gitignore" (
    call :step "Creation du .gitignore..."
    > .gitignore (
        echo node_modules/
        echo dist/
        echo out/
        echo build/
        echo release/
        echo .env
        echo *.log
    )
)

call :step "Analyse des changements..."
git add -A
git diff --cached --quiet
if not errorlevel 1 (
    call :warn "Aucun changement a publier."
    goto :end
)

echo.
echo %C_DIM%--------------------------------------------------%C_RESET%
git status --short
echo %C_DIM%--------------------------------------------------%C_RESET%
echo.

set "MSG="
set /p "MSG=%C_INFO%Message de commit (Entree = auto) : %C_RESET%"
if not defined MSG set "MSG=Update %date% %time:~0,5%"

call :step "Commit en cours..."
git commit -q -m "%MSG%"
if errorlevel 1 (
    call :err "Le commit a echoue."
    goto :end
)

git ls-remote --exit-code --heads origin %BRANCH% >nul 2>&1
if not errorlevel 1 (
    call :step "Synchronisation avec le depot distant..."
    git pull --rebase -q origin %BRANCH%
    if errorlevel 1 (
        call :err "Conflit lors du pull. Resous-le puis relance le script."
        goto :end
    )
)

call :step "Envoi vers GitHub..."
git push -u origin %BRANCH%
if errorlevel 1 (
    call :err "Le push a echoue."
    goto :end
)

echo.
echo %C_OK%  Publie avec succes sur %BRANCH%%C_RESET%
echo %C_DIM%  %REPO%%C_RESET%

call :ask_release

:end
echo.
pause >nul
endlocal
exit /b

:banner
echo.
echo %C_TITLE%  ==================================================%C_RESET%
echo %C_TITLE%     JONESY-LAUNCHER  ^|  PUBLISH TO GITHUB%C_RESET%
echo %C_TITLE%  ==================================================%C_RESET%
echo.
exit /b

:step
echo %C_DIM%  ^> %~1%C_RESET%
exit /b

:warn
echo.
echo %C_WARN%  [!] %~1%C_RESET%
exit /b

:err
echo.
echo %C_ERR%  [X] %~1%C_RESET%
exit /b

:ask_release
echo.
set "DOREL="
set /p "DOREL=%C_INFO%Creer une release maintenant ? (o/N) : %C_RESET%"
if /i not "%DOREL%"=="o" exit /b

rem --- Cherche le dernier tag vX.Y.Z et propose le patch suivant ---
set "LASTTAG="
for /f "delims=" %%t in ('git tag --list "v*.*.*" --sort=-v:refname 2^>nul') do (
    if not defined LASTTAG set "LASTTAG=%%t"
)

if not defined LASTTAG (
    echo %C_DIM%  Derniere version : aucune%C_RESET%
    set "NEXTTAG=v1.0.0"
) else (
    echo %C_DIM%  Derniere version : %LASTTAG%%C_RESET%
    set "VER=%LASTTAG:v=%"
    for /f "tokens=1,2,3 delims=." %%a in ("%VER%") do (
        set "MAJOR=%%a"
        set "MINOR=%%b"
        set /a "PATCH=%%c+1"
    )
    set "NEXTTAG=v!MAJOR!.!MINOR!.!PATCH!"
)

set "NEWTAG="
set /p "NEWTAG=%C_INFO%Numero de version (Entree = !NEXTTAG!) : %C_RESET%"
if not defined NEWTAG set "NEWTAG=!NEXTTAG!"

rem Accepte le numero avec ou sans "v" devant
set "FIRSTCHAR=!NEWTAG:~0,1!"
if /i not "!FIRSTCHAR!"=="v" set "NEWTAG=v!NEWTAG!"

git rev-parse "!NEWTAG!" >nul 2>&1
if not errorlevel 1 (
    call :err "Le tag !NEWTAG! existe deja."
    exit /b
)

call :step "Creation et envoi du tag !NEWTAG!..."
git tag "!NEWTAG!"
git push origin "!NEWTAG!"
if errorlevel 1 (
    call :err "L'envoi du tag a echoue."
    exit /b
)

echo.
echo %C_OK%  Tag !NEWTAG! envoye : le build GitHub Actions va se declencher.%C_RESET%
echo %C_DIM%  https://github.com/yaya992/Jonesy-Launcher/actions%C_RESET%
exit /b