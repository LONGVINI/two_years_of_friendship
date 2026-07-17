$git = "C:\Program Files\Git\cmd\git.exe"

if (Test-Path ".git\index.lock") {
    Remove-Item -Force ".git\index.lock"
}

& $git reset
& $git branch -M main
& $git add .
& $git commit -m "Финальные правки альбома"

& $git remote remove origin 2>$null
& $git remote add origin "https://github.com/LONGVINI/two_years_of_friendship.git"

& $git push -u origin main --force
