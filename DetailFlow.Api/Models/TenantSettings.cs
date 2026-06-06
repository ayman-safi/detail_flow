namespace DetailFlow.Api.Models;

public class TenantSettings
{
    public int BayCapacity { get; set; } = 3;
    public TenantCurrency Currency { get; set; } = TenantCurrency.SAR;
    public List<WorkingDay> WorkingDays { get; set; } = DefaultWorkingDays();
    public List<ClosurePeriod> ClosurePeriods { get; set; } = [];

    public static List<WorkingDay> DefaultWorkingDays() =>
        Enum.GetValues<DayOfWeek>().Select(d => new WorkingDay
        {
            Day = d,
            IsOpen = d != DayOfWeek.Friday,
            OpenTime = new TimeOnly(8, 0),
            CloseTime = new TimeOnly(20, 0)
        }).ToList();
}

public class WorkingDay
{
    public DayOfWeek Day { get; set; }
    public bool IsOpen { get; set; }
    public TimeOnly OpenTime { get; set; }
    public TimeOnly CloseTime { get; set; }
}

public class ClosurePeriod
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public string? Reason { get; set; }
}

public enum TenantCurrency
{
    SAR,
    USD,
    TRY,
    EUR,
    SYP
}

public static class TenantCurrencies
{
    public static readonly TenantCurrency[] Supported =
    [
        TenantCurrency.SAR,
        TenantCurrency.USD,
        TenantCurrency.TRY,
        TenantCurrency.EUR,
        TenantCurrency.SYP
    ];

    public static bool IsSupported(TenantCurrency currency) => Supported.Contains(currency);

    public static TenantCurrency Normalize(TenantCurrency currency) =>
        IsSupported(currency) ? currency : TenantCurrency.SAR;

    public static string Symbol(TenantCurrency currency) => Normalize(currency) switch
    {
        TenantCurrency.SAR => "SAR",
        TenantCurrency.USD => "$",
        TenantCurrency.TRY => "TL",
        TenantCurrency.EUR => "EUR",
        TenantCurrency.SYP => "SYP",
        _ => "SAR"
    };

    public static string Label(TenantCurrency currency) => Normalize(currency) switch
    {
        TenantCurrency.SAR => "Saudi riyal",
        TenantCurrency.USD => "US dollar",
        TenantCurrency.TRY => "Turkish lira",
        TenantCurrency.EUR => "Euro",
        TenantCurrency.SYP => "Syrian pound",
        _ => "Saudi riyal"
    };
}
