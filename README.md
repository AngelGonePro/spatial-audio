You must install Node.js: https://nodejs.org/
You must download ffmpeg: https://www.ffmpeg.org/download.html
And extract it in a location, in my case `C:\Users\Angel\Documents\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe`
So in the index.html file looke for `const ffmpeg = "C:\\Users\\Angel\\Documents\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe";` and replace it to were you extracted yours.
After installing Node.js go to the directory you downloaded, in my case `C:\Users\Angel\Downloads\spatial-upmixer`
Copy the directory
Open Powershell and do `cd C:\Users\Angel\Downloads\spatial-upmixer`
Then run `npm install` and `npm install electron --save-dev` if needed
Then run `npm start`
