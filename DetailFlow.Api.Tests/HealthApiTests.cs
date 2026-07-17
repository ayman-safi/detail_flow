using System.Net;

namespace DetailFlow.Api.Tests;

public class HealthApiTests
{
    [Theory]
    [InlineData("/api/health/live")]
    [InlineData("/api/health/ready")]
    public async Task Health_endpoints_are_available_anonymously(string path)
    {
        using var app = new DetailFlowApiFactory();
        var client = TestApi.CreateClient(app);

        var response = await client.GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }
}
