# cara mengggunakan library ini

## buat file .env dan contoh isi dengan

> GEMINI_API_KEY={api_key}
>
> WABOT_NAME=wabot
>
> WABOT_SUFFIX=, tolong response dengan sintaks whatsapp dan gaya bahasa informal

notes: untuk mendapatkan gemini api key bisa ke link berikut https://aistudio.google.com/app/apikey

## jalankan script

node wa-api.js --wanumber="62423423423" --port=30600

## fitur sederhana di library ini

- api untuk kirim pesan teks ke nomor wa tertentu
- api untuk kirim pesan gambar ke nomor wa tertentu
- api untuk kirim pesan file ke nomor wa tertentu
- wa number berlaku sebagai chatbot dengan ai gemini, gunakan prefix nama wabot nya sebelum bertanya, contoh : wabot siapa presiden indonesia saat ini?
