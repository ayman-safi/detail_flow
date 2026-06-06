FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY DetailFlow.Api.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet restore DetailFlow.Api.csproj --runtime linux-x64
RUN dotnet build DetailFlow.Api.csproj -c Release -r linux-x64 --no-restore
RUN dotnet publish DetailFlow.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false
RUN dotnet tool install --tool-path /tools dotnet-ef --version "10.*" \
 && /tools/dotnet-ef migrations bundle \
    --project DetailFlow.Api.csproj \
    --configuration Release \
    --runtime linux-x64 \
    --target-runtime linux-x64 \
    --self-contained \
    --no-build \
    --output /app/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:5000 \
    DOTNET_EnableDiagnostics=0
COPY --from=build /app/publish ./
COPY --from=build /app/efbundle ./efbundle
RUN chmod +x ./efbundle \
 && mkdir -p /var/lib/detailflow/data-protection-keys \
 && chown -R app:app /app /var/lib/detailflow
USER app
EXPOSE 5000
ENTRYPOINT ["dotnet", "DetailFlow.Api.dll"]
