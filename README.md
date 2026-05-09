# DIRECTIONS
- Upmixing Stereo Audio like Dolby Atmos or want to DownMix Dolby Atmos to stereo? Here you go then :q
---

<br>

You must install Node.js: https://nodejs.org/

<br>

You must download ffmpeg: https://www.ffmpeg.org/download.html

<br>

And extract it in a location, in my case `C:\Users\Angel\Documents\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe`

<br>

So in the index.html file looke for `const ffmpeg = "C:\\Users\\Angel\\Documents\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe";` and replace it to were you extracted yours.

<br>

After installing Node.js go to the directory you downloaded, in my case `C:\Users\Angel\Downloads\spatial-upmixer`

<br>

Copy the directory

<br>

Open Powershell and do `cd C:\Users\Angel\Downloads\spatial-upmixer`

<br>

Then run `npm install` and `npm install electron --save-dev` if needed

<br>

Then run `npm start`
