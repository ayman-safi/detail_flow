# DetailFlow in Visual Studio

1. Open `DetailFlow.sln`.
2. Set `DetailFlow.Api` as the startup project.
3. Use the `http` launch profile. It starts on `http://localhost:5000` and opens Swagger.
4. Start PostgreSQL before using database-backed endpoints:

```powershell
copy .env.example .env
docker compose up -d postgres
dotnet ef database update --project DetailFlow.Api
```

5. Start the frontend from Visual Studio's terminal:

```powershell
cd detailflow-web
$env:NEXT_PUBLIC_API_URL="http://localhost:5000/api"
npm run dev
```

The API launch profile includes local development placeholders for JWT and R2 settings so F5 can start immediately. Replace them with real values for upload flows.
