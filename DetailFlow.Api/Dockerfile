# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/dotnet/sdk:10.0.301-bookworm-slim AS build
WORKDIR /src

COPY NuGet.Config global.json DetailFlow.sln ./
COPY DetailFlow.Api/DetailFlow.Api.csproj DetailFlow.Api/
RUN dotnet restore DetailFlow.Api/DetailFlow.Api.csproj \
    --runtime linux-x64 \
    --configfile NuGet.Config

COPY DetailFlow.Api/ DetailFlow.Api/
WORKDIR /src/DetailFlow.Api
RUN dotnet build DetailFlow.Api.csproj \
    --configuration Release \
    --runtime linux-x64 \
    --no-restore \
 && dotnet publish DetailFlow.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false \
 && dotnet tool install \
    --tool-path /tools \
    dotnet-ef \
    --version 10.0.10 \
    --add-source https://api.nuget.org/v3/index.json \
 && /tools/dotnet-ef migrations bundle \
    --project DetailFlow.Api.csproj \
    --configuration Release \
    --runtime linux-x64 \
    --target-runtime linux-x64 \
    --self-contained \
    --no-build \
    --output /app/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:10.0.10-bookworm-slim AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:5000 \
    DOTNET_EnableDiagnostics=0

RUN apt-get update \
 && apt-get install --yes --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /var/lib/detailflow/data-protection-keys \
 && chown -R app:app /app /var/lib/detailflow

COPY --from=build --chown=app:app /app/publish ./
COPY --from=build --chown=app:app /app/efbundle ./efbundle
RUN chmod +x ./efbundle

USER app
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["curl", "--fail", "--silent", "--show-error", "http://127.0.0.1:5000/api/health/live"]

ENTRYPOINT ["dotnet", "DetailFlow.Api.dll"]
