import { supabase } from "./supabase";
import { AuditModule, getAuditLogger } from "./components/Audit/auditLogger";

/**
 * API Wrapper - Routes all API calls to Supabase
 * This replaces localhost:5000 backend calls with Supabase queries
 * Version: 2.1 - Force redeploy - All screens now use API wrapper
 * Build: 20260201
 */

// Types
interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

// Helper to simulate fetch response
const createResponse = <T>(
  data: T | null,
  error: string | null,
  status: number,
): ApiResponse<T> => ({
  data,
  error,
  status,
});

// Helper to transform Supabase rsbsa_submission record to frontend format
const transformRsbsaRecord = (item: any) => {
  // Get name parts from columns with spaces (Supabase format)
  const lastName = item["LAST NAME"] || "";
  const firstName = item["FIRST NAME"] || "";
  const middleName = item["MIDDLE NAME"] || "";
  const extName = item["EXT NAME"] || "";

  // Build farmer name in "LastName, FirstName MiddleName ExtName" format
  let farmerName = lastName;
  if (firstName) farmerName += `, ${firstName}`;
  if (middleName) farmerName += ` ${middleName}`;
  if (extName) farmerName += ` ${extName}`;

  // Get address/location fields
  const barangay = item["BARANGAY"] || "";
  const municipality = item["MUNICIPALITY"] || "Dumangas";
  const farmLocation = item["FARM LOCATION"] || barangay || "";

  // Build farmer address
  const farmerAddress = [barangay, municipality, "Iloilo"]
    .filter(Boolean)
    .join(", ");

  // Get other fields
  const parcelArea = item["PARCEL AREA"] || item["TOTAL FARM AREA"] || "";
  const status = item.status || "Submitted";
  const referenceNumber = item["FFRS_CODE"] || `RSBSA-${item.id}`;
  const dateSubmitted = item.submitted_at || item.created_at || "";

  // Get ownership type
  const ownershipType = {
    registeredOwner: item["OWNERSHIP_TYPE_REGISTERED_OWNER"] || false,
    tenant: item["OWNERSHIP_TYPE_TENANT"] || false,
    lessee: item["OWNERSHIP_TYPE_LESSEE"] || false,
  };

  return {
    id: item.id,
    referenceNumber,
    farmerName: farmerName || "N/A",
    firstName,
    middleName,
    lastName,
    extName,
    farmerAddress,
    farmLocation,
    parcelArea: String(parcelArea),
    dateSubmitted,
    status,
    landParcel: farmLocation,
    ownershipType,
    gender: item["GENDER"] || "",
    birthdate: item["BIRTHDATE"] || "",
    age: item.age || null,
    mainLivelihood: item["MAIN LIVELIHOOD"] || "",
    totalFarmArea: item["TOTAL FARM AREA"] || 0,
    // Farming activities
    farmerRice: item["FARMER_RICE"] || false,
    farmerCorn: item["FARMER_CORN"] || false,
    farmerOtherCrops: item["FARMER_OTHER_CROPS"] || false,
    farmerOtherCropsText: item["FARMER_OTHER_CROPS_TEXT"] || "",
    farmerLivestock: item["FARMER_LIVESTOCK"] || false,
    farmerLivestockText: item["FARMER_LIVESTOCK_TEXT"] || "",
    farmerPoultry: item["FARMER_POULTRY"] || false,
    farmerPoultryText: item["FARMER_POULTRY_TEXT"] || "",
    // Keep raw data for debugging
    _raw: item,
  };
};

// ==================== DASHBOARD STATS ====================

// Get comprehensive dashboard statistics using Supabase
export const getDashboardStats = async (
  seasonOrAllocationId?: string | number,
  isAllocationId: boolean = false,
): Promise<ApiResponse> => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const defaultSeason =
      month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;

    let allocationFilterId: number | null = null;
    if (
      isAllocationId &&
      seasonOrAllocationId !== undefined &&
      seasonOrAllocationId !== null
    ) {
      const parsedAllocationId = Number(seasonOrAllocationId);
      if (Number.isFinite(parsedAllocationId) && parsedAllocationId > 0) {
        allocationFilterId = parsedAllocationId;
      }
    }

    let currentSeason =
      !isAllocationId &&
      typeof seasonOrAllocationId === "string" &&
      seasonOrAllocationId
        ? seasonOrAllocationId
        : defaultSeason;

    let selectedAllocation: any = null;
    if (allocationFilterId !== null) {
      const { data: selectedAllocationData, error: selectedAllocationError } =
        await supabase
          .from("regional_allocations")
          .select("*")
          .eq("id", allocationFilterId);

      if (selectedAllocationError) {
        console.error(
          "Error fetching selected allocation:",
          selectedAllocationError,
        );
      } else {
        selectedAllocation = selectedAllocationData?.[0] || null;
        if (selectedAllocation?.season) {
          currentSeason = selectedAllocation.season;
        }
      }
    }

    const { data: farmersData, error: farmersError } = await supabase
      .from("rsbsa_submission")
      .select("id, status, OWNERSHIP_TYPE_TENANT, OWNERSHIP_TYPE_LESSEE", {
        count: "exact",
      });

    if (farmersError) {
      console.error("Error fetching farmers:", farmersError);
    }

    const totalFarmers = farmersData?.length || 0;
    const activeFarmers =
      farmersData?.filter(
        (f) =>
          f.status?.toLowerCase() === "active farmer" ||
          f.status?.toLowerCase() === "active",
      ).length || 0;

    const lesseeTenantCount =
      farmersData?.filter(
        (f) =>
          f.OWNERSHIP_TYPE_LESSEE === true || f.OWNERSHIP_TYPE_TENANT === true,
      ).length || 0;

    let currentRequestsQuery = supabase
      .from("farmer_requests")
      .select("id, status, season, allocation_id, barangay");

    if (allocationFilterId !== null) {
      currentRequestsQuery = currentRequestsQuery.eq(
        "allocation_id",
        allocationFilterId,
      );
    } else {
      currentRequestsQuery = currentRequestsQuery.eq("season", currentSeason);
    }

    const [
      { data: currentRequestsData, error: currentRequestsError },
      { data: allRequestsData, error: allRequestsError },
    ] = await Promise.all([
      currentRequestsQuery,
      supabase.from("farmer_requests").select("id, status"),
    ]);

    if (currentRequestsError) {
      console.error("Error fetching filtered requests:", currentRequestsError);
    }
    if (allRequestsError) {
      console.error("Error fetching all requests:", allRequestsError);
    }

    const seasonRequests = currentRequestsData || [];
    const allRequests = allRequestsData || [];

    const currentSeasonStats = {
      total: seasonRequests.length,
      pending: seasonRequests.filter((r) => r.status === "pending").length,
      approved: seasonRequests.filter((r) => r.status === "approved").length,
      rejected: seasonRequests.filter((r) => r.status === "rejected").length,
      distributed: seasonRequests.filter((r) => r.status === "distributed")
        .length,
    };

    const allTimeStats = {
      total: allRequests.length,
      pending: allRequests.filter((r) => r.status === "pending").length,
      approved: allRequests.filter((r) => r.status === "approved").length,
      distributed: allRequests.filter((r) => r.status === "distributed").length,
    };

    const totalRequests = currentSeasonStats.total || 1;
    const statusBreakdown = {
      approved: Math.round((currentSeasonStats.approved / totalRequests) * 100),
      pending: Math.round((currentSeasonStats.pending / totalRequests) * 100),
      rejected: Math.round((currentSeasonStats.rejected / totalRequests) * 100),
      distributed: Math.round(
        (currentSeasonStats.distributed / totalRequests) * 100,
      ),
    };

    let allocationRows: any[] = [];
    if (allocationFilterId !== null) {
      allocationRows = selectedAllocation ? [selectedAllocation] : [];
    } else {
      const { data: seasonAllocations, error: seasonAllocationsError } =
        await supabase
          .from("regional_allocations")
          .select("*")
          .eq("season", currentSeason);

      if (seasonAllocationsError) {
        console.error(
          "Error fetching season allocations:",
          seasonAllocationsError,
        );
      }

      allocationRows = seasonAllocations || [];
    }

    const fertilizerAllocationFields = [
      "urea_46_0_0_bags",
      "complete_14_14_14_bags",
      "complete_16_16_16_bags",
      "np_16_20_0_bags",
      "ammonium_phosphate_16_20_0_bags",
      "ammonium_sulfate_21_0_0_bags",
      "muriate_potash_0_0_60_bags",
      "zinc_sulfate_bags",
      "vermicompost_bags",
      "chicken_manure_bags",
      "rice_straw_kg",
      "carbonized_rice_hull_bags",
      "biofertilizer_liters",
      "nanobiofertilizer_liters",
      "organic_root_exudate_mix_liters",
      "azolla_microphylla_kg",
      "foliar_liquid_fertilizer_npk_liters",
    ] as const;

    const seedAllocationFields = [
      "rice_seeds_nsic_rc160_kg",
      "rice_seeds_nsic_rc222_kg",
      "jackpot_kg",
      "us88_kg",
      "th82_kg",
      "rh9000_kg",
      "lumping143_kg",
      "lp296_kg",
      "mestiso_1_kg",
      "mestiso_20_kg",
      "mestiso_29_kg",
      "mestiso_55_kg",
      "mestiso_73_kg",
      "mestiso_99_kg",
      "mestiso_103_kg",
      "nsic_rc402_kg",
      "nsic_rc480_kg",
      "nsic_rc216_kg",
      "nsic_rc218_kg",
      "nsic_rc506_kg",
      "nsic_rc508_kg",
      "nsic_rc512_kg",
      "nsic_rc534_kg",
      "tubigan_28_kg",
      "tubigan_30_kg",
      "tubigan_22_kg",
      "sahod_ulan_2_kg",
      "sahod_ulan_10_kg",
      "salinas_6_kg",
      "salinas_7_kg",
      "salinas_8_kg",
      "malagkit_5_kg",
    ] as const;

    const sumAllocationFields = (
      rows: any[],
      fields: readonly string[],
    ): number => {
      return rows.reduce(
        (total, row) =>
          total +
          fields.reduce(
            (fieldSum, field) => fieldSum + (Number(row?.[field]) || 0),
            0,
          ),
        0,
      );
    };

    const fertilizerAllocated = sumAllocationFields(
      allocationRows,
      fertilizerAllocationFields,
    );
    const seedsAllocated = sumAllocationFields(
      allocationRows,
      seedAllocationFields,
    );

    const seasonRequestIds = seasonRequests.map((r) => r.id);

    let totalFertilizerDistributed = 0;
    let totalSeedsDistributed = 0;

    if (seasonRequestIds.length > 0) {
      const { data: distributionData, error: distributionError } =
        await supabase
          .from("distribution_records")
          .select("fertilizer_bags_given, seed_kg_given, request_id")
          .in("request_id", seasonRequestIds);

      if (distributionError) {
        console.error(
          "Error fetching distribution records:",
          distributionError,
        );
      } else {
        totalFertilizerDistributed =
          distributionData?.reduce(
            (sum, d) => sum + (d.fertilizer_bags_given || 0),
            0,
          ) || 0;
        totalSeedsDistributed =
          distributionData?.reduce(
            (sum, d) => sum + (d.seed_kg_given || 0),
            0,
          ) || 0;
      }
    }

    const fertilizerProgress =
      fertilizerAllocated > 0
        ? Math.round((totalFertilizerDistributed / fertilizerAllocated) * 100)
        : 0;
    const seedsProgress =
      seedsAllocated > 0
        ? Math.round((totalSeedsDistributed / seedsAllocated) * 100)
        : 0;
    const totalAllocated = fertilizerAllocated + seedsAllocated;
    const totalDistributed = totalFertilizerDistributed + totalSeedsDistributed;
    const overallProgress =
      totalAllocated > 0
        ? Math.round((totalDistributed / totalAllocated) * 100)
        : 0;

    const { data: barangayData } = await supabase
      .from("rsbsa_submission")
      .select("BARANGAY");

    const uniqueBarangays = new Set(
      barangayData?.map((b) => b.BARANGAY).filter(Boolean),
    );
    const requestBarangays = new Set(
      seasonRequests.map((r) => r.barangay).filter(Boolean),
    );

    const seasonEndDateFromAllocation =
      selectedAllocation?.season_end_date ||
      allocationRows.find((a) => a?.season_end_date)?.season_end_date;
    const fallbackSeasonEndDate =
      month >= 5 && month <= 10
        ? `October 31, ${year}`
        : `April 30, ${year + (month <= 4 ? 0 : 1)}`;

    const dashboardStats = {
      currentSeason,
      seasonEndDate: seasonEndDateFromAllocation || fallbackSeasonEndDate,
      farmers: {
        total: totalFarmers,
        active: activeFarmers,
        lessee: lesseeTenantCount,
      },
      requests: {
        currentSeason: currentSeasonStats,
        allTime: allTimeStats,
        statusBreakdown,
      },
      distribution: {
        fertilizer: {
          allocated: fertilizerAllocated,
          distributed: totalFertilizerDistributed,
          remaining: Math.max(
            0,
            fertilizerAllocated - totalFertilizerDistributed,
          ),
          progress: fertilizerProgress,
        },
        seeds: {
          allocated: seedsAllocated,
          distributed: totalSeedsDistributed,
          remaining: Math.max(0, seedsAllocated - totalSeedsDistributed),
          progress: seedsProgress,
        },
        overall: {
          progress: overallProgress,
          totalAllocated,
          totalDistributed,
        },
      },
      coverage: {
        totalBarangays: uniqueBarangays.size,
        barangaysWithRequests: requestBarangays.size,
      },
      processingTime: {
        averageDays: "N/A",
      },
    };

    console.log("Dashboard stats from Supabase:", dashboardStats);
    return createResponse(dashboardStats, null, 200);
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    return createResponse(null, error.message, 500);
  }
};

// Get monthly distribution trends using Supabase
export const getMonthlyTrends = async (
  seasonOrAllocationId?: string | number,
  isAllocationId: boolean = false,
): Promise<ApiResponse> => {
  try {
    let requestsQuery = supabase.from("farmer_requests").select("id");

    if (seasonOrAllocationId !== undefined && seasonOrAllocationId !== null) {
      if (isAllocationId) {
        requestsQuery = requestsQuery.eq("allocation_id", seasonOrAllocationId);
      } else {
        requestsQuery = requestsQuery.eq("season", seasonOrAllocationId);
      }
    } else {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const defaultSeason =
        month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
      requestsQuery = requestsQuery.eq("season", defaultSeason);
    }

    const { data: filteredRequests, error: filteredRequestsError } =
      await requestsQuery;
    if (filteredRequestsError) {
      console.error(
        "Error fetching filtered requests for trends:",
        filteredRequestsError,
      );
      return createResponse([], null, 200);
    }

    const requestIds = (filteredRequests || []).map((r) => r.id);
    if (requestIds.length === 0) {
      return createResponse([], null, 200);
    }

    const { data: distributionData, error } = await supabase
      .from("distribution_records")
      .select(
        "distribution_date, fertilizer_bags_given, seed_kg_given, request_id",
      )
      .in("request_id", requestIds)
      .order("distribution_date", { ascending: true });

    if (error) {
      console.error("Error fetching distribution records:", error);
      return createResponse([], null, 200);
    }

    const monthlyData: {
      [key: string]: { fertilizer: number; seeds: number; count: number };
    } = {};
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    (distributionData || []).forEach((record) => {
      if (record.distribution_date) {
        const date = new Date(record.distribution_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { fertilizer: 0, seeds: 0, count: 0 };
        }

        monthlyData[monthKey].fertilizer += record.fertilizer_bags_given || 0;
        monthlyData[monthKey].seeds += record.seed_kg_given || 0;
        monthlyData[monthKey].count += 1;
      }
    });

    const trends = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => {
        const [_year, monthNum] = month.split("-");
        return {
          month,
          monthName: monthNames[parseInt(monthNum) - 1],
          fertilizer: data.fertilizer,
          seeds: data.seeds,
          count: data.count,
        };
      });

    return createResponse(trends, null, 200);
  } catch (error: any) {
    console.error("Error fetching monthly trends:", error);
    return createResponse([], null, 200);
  }
};

// Get recent activity using Supabase
export const getRecentActivity = async (
  limit: number = 5,
  seasonOrAllocationId?: string | number,
  isAllocationId: boolean = false,
): Promise<ApiResponse> => {
  try {
    let filteredRequestIds: (string | number)[] | null = null;

    if (seasonOrAllocationId !== undefined && seasonOrAllocationId !== null) {
      let requestsQuery = supabase.from("farmer_requests").select("id");

      if (isAllocationId) {
        requestsQuery = requestsQuery.eq("allocation_id", seasonOrAllocationId);
      } else {
        requestsQuery = requestsQuery.eq("season", seasonOrAllocationId);
      }

      const { data: requestsData, error: requestsError } = await requestsQuery;
      if (requestsError) {
        console.error(
          "Error fetching filtered requests for recent activity:",
          requestsError,
        );
        return createResponse([], null, 200);
      }

      filteredRequestIds = (requestsData || []).map((r) => r.id);
      if (filteredRequestIds.length === 0) {
        return createResponse([], null, 200);
      }
    }

    let query = supabase.from("distribution_records").select(`
                id,
                request_id,
                fertilizer_type,
                fertilizer_bags_given,
                seed_type,
                seed_kg_given,
                distribution_date,
                verified_by,
                created_at,
                farmer_requests (
                    farmer_name,
                    barangay
                )
            `);

    if (filteredRequestIds) {
      query = query.in("request_id", filteredRequestIds);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent activity:", error);
      return createResponse([], null, 200);
    }

    const flattenedData = (data || []).map((record: any) => {
      const farmerRequest = record.farmer_requests;
      return {
        id: record.id,
        farmer_name: farmerRequest?.farmer_name || "Unknown",
        barangay: farmerRequest?.barangay || "Unknown",
        fertilizer_type: record.fertilizer_type,
        fertilizer_bags_given: record.fertilizer_bags_given,
        seed_type: record.seed_type,
        seed_kg_given: record.seed_kg_given,
        distribution_date: record.distribution_date,
        verified_by: record.verified_by,
        created_at: record.created_at,
      };
    });

    return createResponse(flattenedData, null, 200);
  } catch (error: any) {
    console.error("Error fetching recent activity:", error);
    return createResponse([], null, 200);
  }
};

// Get available seasons using Supabase
export const getAvailableSeasons = async (): Promise<ApiResponse> => {
  try {
    const { data, error } = await supabase
      .from("regional_allocations")
      .select(
        "id, season, allocation_date, season_start_date, season_end_date, status, notes",
      )
      .order("allocation_date", { ascending: false });

    if (error) {
      console.error("Error fetching seasons:", error);
      // Return default season on error
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const defaultSeason =
        month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
      return createResponse(
        [
          {
            id: 0,
            season: defaultSeason,
            allocation_date: new Date().toISOString().split("T")[0],
            season_start_date: "",
            season_end_date: "",
            status: "active",
          },
        ],
        null,
        200,
      );
    }

    // If no allocations exist, return current season
    if (!data || data.length === 0) {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const defaultSeason =
        month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
      return createResponse(
        [
          {
            id: 0,
            season: defaultSeason,
            allocation_date: new Date().toISOString().split("T")[0],
            season_start_date: "",
            season_end_date: "",
            status: "active",
          },
        ],
        null,
        200,
      );
    }

    return createResponse(data, null, 200);
  } catch (error: any) {
    console.error("Error fetching available seasons:", error);
    return createResponse(null, error.message, 500);
  }
};

// ==================== TECHNICIAN DASHBOARD ====================

export const getTechDashboardData = async (): Promise<ApiResponse> => {
  try {
    const [farmersResult, plotsResult, barangayResult, parcelsResult] =
      await Promise.all([
        supabase
          .from("rsbsa_submission")
          .select('id, "FIRST NAME", "LAST NAME", "BARANGAY", "FFRS_CODE"'),
        supabase
          .from("land_plots")
          .select("id, ffrs_id, barangay, parcel_number, first_name, surname"),
        supabase.from("barangay_codes").select("barangay_name"),
        supabase
          .from("rsbsa_farm_parcels")
          .select("id, submission_id, parcel_number, farm_location_barangay"),
      ]);

    if (farmersResult.error) throw farmersResult.error;

    const farmers = farmersResult.data || [];
    const plots = plotsResult.data || [];
    const barangayCodes = barangayResult.data || [];
    const farmParcels = parcelsResult.data || [];

    // Normalise a string for case-insensitive, whitespace-insensitive comparison
    const normalize = (s: string) => (s || "").toLowerCase().trim();

    // Build a lookup: farmer id -> { ffrs, firstName, lastName }
    const farmerFfrsMap = new Map<
      number,
      { ffrs: string; firstName: string; lastName: string }
    >();
    farmers.forEach((f: any) => {
      farmerFfrsMap.set(f.id, {
        ffrs: (f.FFRS_CODE || "").toUpperCase(),
        firstName: normalize(f["FIRST NAME"]),
        lastName: normalize(f["LAST NAME"]),
      });
    });

    // Build a lookup: ffrs_id (uppercase) -> set of plotted barangays (lowercase)
    const plottedByFfrs = new Map<string, Set<string>>();
    plots.forEach((p: any) => {
      if (!p.ffrs_id) return;
      const key = p.ffrs_id.toUpperCase();
      if (!plottedByFfrs.has(key)) plottedByFfrs.set(key, new Set());
      if (p.barangay) plottedByFfrs.get(key)!.add(normalize(p.barangay));
    });

    // Fallback lookup for plots that were saved without ffrs_id (legacy data).
    // Key: "firstname|surname|barangay" (all normalised)
    const plottedByNameBrgy = new Set<string>();
    plots.forEach((p: any) => {
      if (p.ffrs_id) return; // already handled by ffrs path
      if (p.first_name && p.surname && p.barangay) {
        plottedByNameBrgy.add(
          `${normalize(p.first_name)}|${normalize(p.surname)}|${normalize(p.barangay)}`,
        );
      }
    });

    // Build enriched parcel list: each rsbsa_farm_parcels row + isPlotted flag.
    // A parcel is "plotted" if land_plots has an entry with:
    //   (a) matching ffrs_id AND matching barangay  [primary]
    //   (b) OR matching first_name + surname + barangay when ffrs_id is absent [fallback]
    const enrichedParcels = farmParcels.map((parcel: any) => {
      const info = farmerFfrsMap.get(parcel.submission_id);
      const ffrs = info?.ffrs || "";
      const parcelBrgy = normalize(parcel.farm_location_barangay || "");

      // Primary: ffrs + barangay match
      const plottedBrgys = ffrs ? plottedByFfrs.get(ffrs) : undefined;
      let isPlotted = plottedBrgys ? plottedBrgys.has(parcelBrgy) : false;

      // Fallback: name + barangay match (covers legacy plots with empty ffrs_id)
      if (!isPlotted && info && parcelBrgy) {
        const nameKey = `${info.firstName}|${info.lastName}|${parcelBrgy}`;
        isPlotted = plottedByNameBrgy.has(nameKey);
      }

      return {
        ...parcel,
        ffrs,
        parcelBrgy,
        isPlotted,
      };
    });

    // For farmers WITHOUT any rsbsa_farm_parcels entries, create a synthetic
    // single-parcel entry using rsbsa_submission.BARANGAY (backward compat)
    const farmerIdsWithParcels = new Set(
      farmParcels.map((p: any) => p.submission_id),
    );
    const syntheticParcels = farmers
      .filter((f: any) => !farmerIdsWithParcels.has(f.id))
      .map((f: any) => {
        const info = farmerFfrsMap.get(f.id);
        const ffrs = info?.ffrs || "";
        const parcelBrgy = normalize(f.BARANGAY || "");

        // Primary: ffrs + barangay match
        const plottedBrgys = ffrs ? plottedByFfrs.get(ffrs) : undefined;
        let isPlotted = plottedBrgys ? plottedBrgys.has(parcelBrgy) : false;

        // Fallback: name + barangay match
        if (!isPlotted && info && parcelBrgy) {
          const nameKey = `${info.firstName}|${info.lastName}|${parcelBrgy}`;
          isPlotted = plottedByNameBrgy.has(nameKey);
        }

        return {
          submission_id: f.id,
          farm_location_barangay: f.BARANGAY || "",
          ffrs,
          parcelBrgy,
          isPlotted,
          synthetic: true,
        };
      });

    const allParcels = [...enrichedParcels, ...syntheticParcels];

    // Summary counts
    const totalParcels = allParcels.length;
    const plottedParcelCount = allParcels.filter(
      (p: any) => p.isPlotted,
    ).length;
    const unplottedParcelCount = totalParcels - plottedParcelCount;

    const allFarmerIds = new Set(
      allParcels
        .map((p: any) => p.submission_id)
        .filter((id: any) => id !== null && id !== undefined),
    );
    const plottedFarmerIds = new Set(
      allParcels
        .filter((p: any) => p.isPlotted)
        .map((p: any) => p.submission_id)
        .filter((id: any) => id !== null && id !== undefined),
    );

    const plottedFarmerCount = plottedFarmerIds.size;
    const unplottedFarmerCount = Math.max(
      0,
      allFarmerIds.size - plottedFarmerCount,
    );

    // Barangay checklist — group by farm_location_barangay (where the parcel is)
    const barangayNames: string[] =
      barangayCodes.length > 0
        ? barangayCodes.map((b: any) => b.barangay_name)
        : [
            ...new Set(
              allParcels
                .map((p: any) => p.farm_location_barangay)
                .filter(Boolean) as string[],
            ),
          ].sort();

    const barangayChecklist = barangayNames
      .map((brgy) => {
        const bLower = brgy.toLowerCase().trim();
        const parcelsInBrgy = allParcels.filter(
          (p: any) => p.parcelBrgy === bLower,
        );
        const plottedInBrgy = parcelsInBrgy.filter((p: any) => p.isPlotted);
        const uniqueFarmers = new Set(
          parcelsInBrgy
            .map((p: any) => p.submission_id)
            .filter((id: any) => id !== null && id !== undefined),
        );
        const plottedFarmers = new Set(
          plottedInBrgy
            .map((p: any) => p.submission_id)
            .filter((id: any) => id !== null && id !== undefined),
        );

        return {
          barangay: brgy,
          farmerCount: uniqueFarmers.size,
          plottedFarmers: plottedFarmers.size,
          parcelCount: parcelsInBrgy.length,
          plottedParcels: plottedInBrgy.length,
          isComplete:
            uniqueFarmers.size > 0 && plottedFarmers.size >= uniqueFarmers.size,
        };
      })
      .filter((row) => row.parcelCount > 0);

    // Unplotted farmers by barangay
    const unplottedByBarangay: Record<string, number> = {};
    barangayChecklist.forEach((row: any) => {
      const unplottedCount = Math.max(
        0,
        Number(row.farmerCount || 0) - Number(row.plottedFarmers || 0),
      );
      if (unplottedCount > 0) {
        unplottedByBarangay[row.barangay] = unplottedCount;
      }
    });

    return createResponse(
      {
        totalFarmers: farmers.length,
        totalParcels,
        totalPlotted: plottedFarmerCount,
        totalUnplotted: unplottedFarmerCount,
        totalPlottedParcels: plottedParcelCount,
        totalUnplottedParcels: unplottedParcelCount,
        barangayChecklist,
        unplottedByBarangay,
      },
      null,
      200,
    );
  } catch (error: any) {
    console.error("Error fetching tech dashboard data:", error);
    return createResponse(null, error.message, 500);
  }
};

// ==================== RSBSA SUBMISSION ====================

export const getRsbsaSubmissions = async (): Promise<ApiResponse> => {
  // Get all submissions
  const { data, error } = await supabase.from("rsbsa_submission").select("*");

  if (error) return createResponse(null, error.message, 500);

  // Get all farm parcels with current ownership status
  const { data: parcelsData } = await supabase
    .from("rsbsa_farm_parcels")
    .select("submission_id, is_current_owner");

  // Create a map of submission_id -> has any current parcels
  const currentOwnershipMap = new Map<number, boolean>();
  (parcelsData || []).forEach((parcel: any) => {
    const subId = parcel.submission_id;
    // If any parcel has is_current_owner = true (or null/undefined which defaults to true), mark as current
    const isCurrent = parcel.is_current_owner !== false;
    if (isCurrent) {
      currentOwnershipMap.set(subId, true);
    } else if (!currentOwnershipMap.has(subId)) {
      currentOwnershipMap.set(subId, false);
    }
  });

  // Show ALL farmers (Masterlist needs everyone). Attach parcel ownership info
  // so individual pages can filter as needed (e.g. RSBSA pages hide transferred owners).
  const filteredData = data || [];

  // Count ALL parcels per submission (including transferred ones)
  // "Number of Parcels" = how many parcels the farmer has ever registered,
  // regardless of whether any were later transferred to another farmer.
  const parcelCountMap = new Map<number, number>();
  (parcelsData || []).forEach((parcel: any) => {
    const subId = parcel.submission_id;
    parcelCountMap.set(subId, (parcelCountMap.get(subId) || 0) + 1);
  });

  // Transform all records and attach ownership info
  const transformedData = filteredData.map((item: any) => {
    const record = transformRsbsaRecord(item);
    const hasCurrentParcels = currentOwnershipMap.get(item.id);
    return {
      ...record,
      // true = has current parcels, false = all transferred, undefined = no parcels at all
      hasCurrentParcels: hasCurrentParcels,
      parcelCount: parcelCountMap.get(item.id) || 0,
      archived_at: item.archived_at ?? null,
      archive_reason: item.archive_reason ?? null,
    };
  });

  console.log(
    "📊 Transformed RSBSA data:",
    transformedData.length,
    "records (filtered from",
    data?.length,
    ")",
  );
  if (transformedData.length > 0) {
    console.log("📝 Sample transformed record:", transformedData[0]);
  }

  return createResponse(transformedData, null, 200);
};

export const getRsbsaSubmissionById = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("rsbsa_submission")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return createResponse(null, error.message, 404);

  // Transform the single record
  const transformedData = transformRsbsaRecord(data);

  return createResponse(transformedData, null, 200);
};

export const createRsbsaSubmission = async (
  submissionData: any,
): Promise<ApiResponse> => {
  const formData = submissionData.data || submissionData;

  // Calculate total farm area from parcels
  const parcels = formData.farmlandParcels || [];
  const totalFarmArea = parcels.reduce((sum: number, p: any) => {
    const area = parseFloat(p.totalFarmAreaHa) || 0;
    return sum + area;
  }, 0);

  // Build the payload for the database function
  const rpcPayload = {
    // Farmer details
    surname: formData.lastName || formData.surname || "",
    firstName: formData.firstName || "",
    middleName: formData.middleName || "",
    extensionName: formData.extName || formData.extensionName || "",
    gender: formData.gender || formData.sex || "",
    dateOfBirth: formData.dateOfBirth || formData.birthdate || null,
    barangay: formData.barangay || formData.address?.barangay || "",
    municipality:
      formData.municipality || formData.address?.municipality || "Dumangas",
    mainLivelihood: formData.mainLivelihood || "",
    totalFarmArea: totalFarmArea,
    // Ownership category
    ownershipCategory: formData.ownershipCategory || "registeredOwner",
    selectedLandOwner: formData.selectedLandOwner || null,
    // Farming activities
    farmerRice: formData.farmerRice || false,
    farmerCorn: formData.farmerCorn || false,
    farmerOtherCrops: formData.farmerOtherCrops || false,
    farmerOtherCropsText: formData.farmerOtherCropsText || "",
    farmerLivestock: formData.farmerLivestock || false,
    farmerLivestockText: formData.farmerLivestockText || "",
    farmerPoultry: formData.farmerPoultry || false,
    farmerPoultryText: formData.farmerPoultryText || "",
    // Parcels with transfer info
    farmlandParcels: parcels.map((p: any) => ({
      farmLocationBarangay: p.farmLocationBarangay || "",
      farmLocationMunicipality: p.farmLocationMunicipality || "Dumangas",
      totalFarmAreaHa: parseFloat(p.totalFarmAreaHa) || 0,
      parcelNo: p.parcelNo || "",
      existingParcelId: p.existingParcelId || null,
      existingParcelNumber: p.existingParcelNumber || null,
      withinAncestralDomain:
        p.withinAncestralDomain === "Yes" || p.withinAncestralDomain === true
          ? "Yes"
          : "No",
      agrarianReformBeneficiary:
        p.agrarianReformBeneficiary === "Yes" ||
        p.agrarianReformBeneficiary === true
          ? "Yes"
          : "No",
      ownershipDocumentNo: p.ownershipDocumentNo || "",
    })),
  };

  console.log(
    "📤 Calling register_farmer_with_parcels RPC:",
    JSON.stringify(rpcPayload.farmlandParcels, null, 2),
  );

  // Call the database function — runs as a single atomic transaction
  const { data, error } = await supabase.rpc("register_farmer_with_parcels", {
    p_data: rpcPayload,
  });

  if (error) {
    console.error("❌ Registration RPC error:", error);
    return createResponse(null, error.message, 500);
  }

  console.log("✅ Registration RPC result:", data);

  // Return in the format the frontend expects
  return createResponse(
    {
      message: data?.message || "Submission successful",
      submissionId: data?.submissionId,
      submittedAt: data?.submittedAt || new Date().toISOString(),
    },
    null,
    201,
  );
};

const hasMeaningfulValue = (value: any): boolean => {
  if (value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const parseFarmerNameParts = (
  farmerName: string,
): { lastName?: string; firstName?: string; middleName?: string } => {
  const normalized = (farmerName || "").trim();
  if (!normalized) return {};

  const commaParts = normalized
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length === 0) return {};
  if (commaParts.length === 1) {
    return { lastName: commaParts[0] };
  }

  const lastName = commaParts[0];
  const firstMiddle = commaParts.slice(1).join(" ");
  const firstMiddleParts = firstMiddle
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    lastName,
    firstName: firstMiddleParts[0],
    middleName: firstMiddleParts.slice(1).join(" ") || undefined,
  };
};

const parseAddressParts = (
  address: string,
): { barangay?: string; municipality?: string } => {
  const normalized = (address || "").trim();
  if (!normalized) return {};

  const parts = normalized
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { barangay: parts[0] };
  return { barangay: parts[0], municipality: parts[1] };
};

const parseAreaToNumber = (value: any): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s*hectares\s*$/i, "").trim();
  if (!cleaned) return undefined;

  // Support inputs like "1.2, 0.8" (sum of parcel areas).
  const parts = cleaned
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const parsed = parts.map((p) => Number(p)).filter((n) => Number.isFinite(n));

  if (parsed.length === 0) return undefined;
  if (parsed.length === 1) return parsed[0];
  return parsed.reduce((sum, n) => sum + n, 0);
};

const normalizeRsbsaSubmissionUpdateData = (raw: any): Record<string, any> => {
  if (!raw || typeof raw !== "object") return {};

  const normalized: Record<string, any> = {};

  // Allow direct DB column names when callers already provide them.
  const directColumnKeys = [
    "status",
    "age",
    "LAST NAME",
    "FIRST NAME",
    "MIDDLE NAME",
    "EXT NAME",
    "GENDER",
    "BIRTHDATE",
    "BARANGAY",
    "MUNICIPALITY",
    "FARM LOCATION",
    "PARCEL AREA",
    "TOTAL FARM AREA",
    "MAIN LIVELIHOOD",
    "OWNERSHIP_TYPE_REGISTERED_OWNER",
    "OWNERSHIP_TYPE_TENANT",
    "OWNERSHIP_TYPE_LESSEE",
    "FARMER_RICE",
    "FARMER_CORN",
    "FARMER_OTHER_CROPS",
    "FARMER_OTHER_CROPS_TEXT",
    "FARMER_LIVESTOCK",
    "FARMER_LIVESTOCK_TEXT",
    "FARMER_POULTRY",
    "FARMER_POULTRY_TEXT",
  ];

  directColumnKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) return;
    const value = raw[key];
    if (value === null || hasMeaningfulValue(value)) {
      normalized[key] = value;
    }
  });

  // age may arrive as a string from edit forms.
  if (Object.prototype.hasOwnProperty.call(raw, "age")) {
    if (raw.age === null) {
      normalized.age = null;
    } else if (hasMeaningfulValue(raw.age)) {
      const parsedAge = Number(raw.age);
      if (Number.isFinite(parsedAge) && parsedAge >= 18) {
        normalized.age = parsedAge;
      }
    }
  }

  const lastName = hasMeaningfulValue(raw.surname)
    ? String(raw.surname).trim()
    : hasMeaningfulValue(raw.lastName)
      ? String(raw.lastName).trim()
      : undefined;
  const firstName = hasMeaningfulValue(raw.firstName)
    ? String(raw.firstName).trim()
    : undefined;
  const middleName = hasMeaningfulValue(raw.middleName)
    ? String(raw.middleName).trim()
    : undefined;
  const extName = hasMeaningfulValue(raw.extName)
    ? String(raw.extName).trim()
    : hasMeaningfulValue(raw.extensionName)
      ? String(raw.extensionName).trim()
      : undefined;

  if (lastName) normalized["LAST NAME"] = lastName;
  if (firstName) normalized["FIRST NAME"] = firstName;
  if (middleName) normalized["MIDDLE NAME"] = middleName;
  if (extName) normalized["EXT NAME"] = extName;

  if (hasMeaningfulValue(raw.farmerName)) {
    const parsed = parseFarmerNameParts(String(raw.farmerName));
    if (!normalized["LAST NAME"] && parsed.lastName)
      normalized["LAST NAME"] = parsed.lastName;
    if (!normalized["FIRST NAME"] && parsed.firstName)
      normalized["FIRST NAME"] = parsed.firstName;
    if (!normalized["MIDDLE NAME"] && parsed.middleName)
      normalized["MIDDLE NAME"] = parsed.middleName;
  }

  const barangay = hasMeaningfulValue(raw.addressBarangay)
    ? String(raw.addressBarangay).trim()
    : hasMeaningfulValue(raw.barangay)
      ? String(raw.barangay).trim()
      : undefined;
  const municipality = hasMeaningfulValue(raw.addressMunicipality)
    ? String(raw.addressMunicipality).trim()
    : hasMeaningfulValue(raw.municipality)
      ? String(raw.municipality).trim()
      : undefined;

  if (barangay) normalized["BARANGAY"] = barangay;
  if (municipality) normalized["MUNICIPALITY"] = municipality;

  if (hasMeaningfulValue(raw.farmerAddress)) {
    const parsed = parseAddressParts(String(raw.farmerAddress));
    if (!normalized["BARANGAY"] && parsed.barangay)
      normalized["BARANGAY"] = parsed.barangay;
    if (!normalized["MUNICIPALITY"] && parsed.municipality)
      normalized["MUNICIPALITY"] = parsed.municipality;
  }

  if (hasMeaningfulValue(raw.gender))
    normalized["GENDER"] = String(raw.gender).trim();
  if (hasMeaningfulValue(raw.birthdate))
    normalized["BIRTHDATE"] = raw.birthdate;
  if (hasMeaningfulValue(raw.dateOfBirth))
    normalized["BIRTHDATE"] = raw.dateOfBirth;
  if (hasMeaningfulValue(raw.farmLocation))
    normalized["FARM LOCATION"] = String(raw.farmLocation).trim();
  if (hasMeaningfulValue(raw.mainLivelihood))
    normalized["MAIN LIVELIHOOD"] = String(raw.mainLivelihood).trim();

  const totalArea = parseAreaToNumber(raw.parcelArea ?? raw.totalFarmArea);
  if (totalArea !== undefined) {
    normalized["TOTAL FARM AREA"] = totalArea;
  }

  if (raw.ownershipType && typeof raw.ownershipType === "object") {
    if (typeof raw.ownershipType.registeredOwner === "boolean") {
      normalized["OWNERSHIP_TYPE_REGISTERED_OWNER"] =
        raw.ownershipType.registeredOwner;
    }
    if (typeof raw.ownershipType.tenant === "boolean") {
      normalized["OWNERSHIP_TYPE_TENANT"] = raw.ownershipType.tenant;
    }
    if (typeof raw.ownershipType.lessee === "boolean") {
      normalized["OWNERSHIP_TYPE_LESSEE"] = raw.ownershipType.lessee;
    }
  }

  return normalized;
};

export const updateRsbsaSubmission = async (
  id: string | number,
  updateData: any,
): Promise<ApiResponse> => {
  // Defensive validation: if age is provided during update, it must be numeric and >= 18.
  if (Object.prototype.hasOwnProperty.call(updateData ?? {}, "age")) {
    const rawAge = updateData?.age;
    if (rawAge !== null && hasMeaningfulValue(rawAge)) {
      const parsedAge = Number(rawAge);
      if (!Number.isFinite(parsedAge) || parsedAge < 18) {
        return createResponse(
          null,
          "Age must be a valid number and at least 18 years old",
          400,
        );
      }
    }
  }

  const normalizedUpdateData = normalizeRsbsaSubmissionUpdateData(updateData);

  if (Object.keys(normalizedUpdateData).length === 0) {
    return createResponse(null, "No valid fields to update", 400);
  }

  const { data, error } = await supabase
    .from("rsbsa_submission")
    .update(normalizedUpdateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const deleteRsbsaSubmission = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { error } = await supabase
    .from("rsbsa_submission")
    .delete()
    .eq("id", id);

  if (error) return createResponse(null, error.message, 500);
  return createResponse({ success: true }, null, 200);
};

// ==================== FARM PARCELS ====================

export const getFarmParcels = async (
  submissionId: string | number,
): Promise<ApiResponse> => {
  // First get the farm parcels
  let { data: parcels, error: parcelsError } = await supabase
    .from("rsbsa_farm_parcels")
    .select("*")
    .eq("submission_id", submissionId);

  if (parcelsError) {
    console.log(
      "Farm parcels query error (non-blocking):",
      parcelsError.message,
    );
    return createResponse([], null, 200);
  }

  if (!parcels || parcels.length === 0) {
    // Fallback: Try to build parcel data from land_history table
    // land_history may exist even when rsbsa_farm_parcels insert failed (e.g. CHECK constraint mismatch)
    const { data: historyParcels, error: historyError } = await supabase
      .from("land_history")
      .select("*")
      .eq("farmer_id", submissionId)
      .eq("is_current", true);

    if (!historyError && historyParcels && historyParcels.length > 0) {
      console.log(
        `📍 No rsbsa_farm_parcels found, but found ${historyParcels.length} land_history record(s) for farmer ${submissionId}`,
      );
      const fallbackParcels = historyParcels.map((h: any) => ({
        id: h.id,
        submission_id: submissionId,
        parcel_number: h.parcel_number || "N/A",
        farm_location_barangay: h.farm_location_barangay || "N/A",
        farm_location_municipality: h.farm_location_municipality || "N/A",
        total_farm_area_ha: h.total_farm_area_ha || 0,
        within_ancestral_domain: h.within_ancestral_domain ? "Yes" : "No",
        agrarian_reform_beneficiary: h.agrarian_reform_beneficiary
          ? "Yes"
          : "No",
        ownership_type_registered_owner: h.is_registered_owner || false,
        ownership_type_tenant: h.is_tenant || false,
        ownership_type_lessee: h.is_lessee || false,
        tenant_land_owner_name: h.is_tenant ? h.land_owner_name || "" : "",
        lessee_land_owner_name: h.is_lessee ? h.land_owner_name || "" : "",
        land_parcel_id: h.land_parcel_id || null,
        _source: "land_history",
      }));
      return createResponse(fallbackParcels, null, 200);
    }

    return createResponse([], null, 200);
  }

  // Now try to get the land_parcel_id from land_history for each parcel
  // This is needed for ownership transfers to properly reference the land parcel
  const enhancedParcels = await Promise.all(
    parcels.map(async (parcel) => {
      // Try to find the land_parcel_id from land_history using parcel_number
      const { data: historyData } = await supabase
        .from("land_history")
        .select("land_parcel_id, parcel_number")
        .eq("farmer_id", submissionId)
        .eq("parcel_number", parcel.parcel_number)
        .eq("is_current", true)
        .single();

      if (historyData && historyData.land_parcel_id) {
        console.log(
          `📍 Found land_parcel_id ${historyData.land_parcel_id} for parcel ${parcel.parcel_number}`,
        );
        return {
          ...parcel,
          land_parcel_id: historyData.land_parcel_id,
        };
      }

      // Fallback: try to find by parcel_number in land_parcels directly
      const { data: landParcelData } = await supabase
        .from("land_parcels")
        .select("id")
        .eq("parcel_number", parcel.parcel_number)
        .single();

      if (landParcelData) {
        console.log(
          `📍 Found land_parcel_id ${landParcelData.id} from land_parcels for ${parcel.parcel_number}`,
        );
        return {
          ...parcel,
          land_parcel_id: landParcelData.id,
        };
      }

      return parcel;
    }),
  );

  return createResponse(enhancedParcels, null, 200);
};

export const createFarmParcel = async (
  parcelData: any,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("rsbsa_farm_parcels")
    .insert(parcelData)
    .select()
    .single();

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 201);
};

export const updateFarmParcel = async (
  id: string | number,
  updateData: any,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("rsbsa_farm_parcels")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

// // ==================== LAND TRANSFER ====================
// export const transferLandOwnership = async (transferData: any): Promise<ApiResponse> => {
//     const { data, error } = await supabase.rpc('transfer_land_ownership', {
//         p_data: transferData
//     });

// // ==================== LAND PLOTS ====================

export const getLandPlots = async (): Promise<ApiResponse> => {
  const { data, error } = await supabase.from("land_plots").select("*");

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const getCropPlantingInfo = async (
  surname: string,
  firstName: string,
  middleName: string,
  barangay: string,
): Promise<any> => {
  try {
    if ((!surname && !firstName) || !barangay) {
      return { owner: null, tenants: [] };
    }

    // Build query for matching the owner in rsbsa_submission
    // Don't filter by barangay in the query since BARANGAY column stores
    // the farmer's HOME address, but we're searching by FARM location.
    // We'll filter results client-side to match either column.
    let query = supabase.from("rsbsa_submission").select(`
                id,
                "FIRST NAME",
                "MIDDLE NAME",
                "LAST NAME",
                "BARANGAY",
                "FARM LOCATION",
                "MAIN LIVELIHOOD",
                "FARMER_RICE",
                "FARMER_CORN",
                "FARMER_OTHER_CROPS",
                "FARMER_OTHER_CROPS_TEXT",
                "FARMER_LIVESTOCK",
                "FARMER_LIVESTOCK_TEXT",
                "FARMER_POULTRY",
                "FARMER_POULTRY_TEXT",
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE",
                status,
                created_at
            `);

    if (surname) {
      query = query.ilike("LAST NAME", surname.trim());
    }
    if (firstName) {
      query = query.ilike("FIRST NAME", `${firstName.trim()}%`);
    }

    const { data: ownerData, error: ownerError } = await query;

    if (ownerError) {
      console.error("Error fetching crop planting info:", ownerError);
      return { owner: null, tenants: [] };
    }

    // Filter client-side: match if BARANGAY or FARM LOCATION contains the search barangay
    const barangayLower = barangay.trim().toLowerCase();
    const filteredOwnerData = (ownerData || []).filter((row: any) => {
      const homeBarangay = (row["BARANGAY"] || "").toLowerCase();
      const farmLocation = (row["FARM LOCATION"] || "").toLowerCase();
      return (
        homeBarangay.includes(barangayLower) ||
        farmLocation.includes(barangayLower)
      );
    });
    console.log(
      "getCropPlantingInfo: filtered from",
      ownerData?.length,
      "to",
      filteredOwnerData.length,
      "results for barangay:",
      barangay,
    );

    // Build crops list helper
    const buildCropsList = (row: any): string[] => {
      if (!row) return [];
      const crops: string[] = [];
      if (row.FARMER_RICE) crops.push("Rice");
      if (row.FARMER_CORN) crops.push("Corn");
      if (row.FARMER_OTHER_CROPS && row.FARMER_OTHER_CROPS_TEXT) {
        crops.push(row.FARMER_OTHER_CROPS_TEXT);
      } else if (row.FARMER_OTHER_CROPS) {
        crops.push("Other Crops");
      }
      if (row.FARMER_LIVESTOCK && row.FARMER_LIVESTOCK_TEXT) {
        crops.push(`Livestock: ${row.FARMER_LIVESTOCK_TEXT}`);
      } else if (row.FARMER_LIVESTOCK) {
        crops.push("Livestock");
      }
      if (row.FARMER_POULTRY && row.FARMER_POULTRY_TEXT) {
        crops.push(`Poultry: ${row.FARMER_POULTRY_TEXT}`);
      } else if (row.FARMER_POULTRY) {
        crops.push("Poultry");
      }
      // Fallback to MAIN LIVELIHOOD
      if (crops.length === 0 && row["MAIN LIVELIHOOD"]) {
        const parts = row["MAIN LIVELIHOOD"]
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        crops.push(...parts);
      }
      return crops.length > 0 ? crops : ["Not specified"];
    };

    // Format owner data
    let owner = null;
    if (filteredOwnerData && filteredOwnerData.length > 0) {
      // Find best match - if middleName provided, prefer exact match
      let bestMatch = filteredOwnerData[0];
      if (middleName && filteredOwnerData.length > 1) {
        const exactMiddle = filteredOwnerData.find(
          (r: any) =>
            (r["MIDDLE NAME"] || "").toLowerCase().trim() ===
            middleName.toLowerCase().trim(),
        );
        if (exactMiddle) bestMatch = exactMiddle;
      }

      const row = bestMatch;
      const farmerName = [
        row["FIRST NAME"],
        row["MIDDLE NAME"],
        row["LAST NAME"],
      ]
        .filter(Boolean)
        .join(" ");
      owner = {
        id: row.id,
        farmer_name: farmerName,
        first_name: row["FIRST NAME"],
        middle_name: row["MIDDLE NAME"],
        last_name: row["LAST NAME"],
        barangay: row.BARANGAY,
        main_livelihood: row["MAIN LIVELIHOOD"],
        registration_date: row.created_at,
        ownership_status: row.OWNERSHIP_TYPE_REGISTERED_OWNER
          ? "Owner"
          : row.OWNERSHIP_TYPE_TENANT
            ? "Tenant"
            : row.OWNERSHIP_TYPE_LESSEE
              ? "Lessee"
              : "Other",
        is_owner: row.OWNERSHIP_TYPE_REGISTERED_OWNER,
        is_tenant: row.OWNERSHIP_TYPE_TENANT,
        is_lessee: row.OWNERSHIP_TYPE_LESSEE,
        farmer_status: row.status,
        crops: buildCropsList(row),
      };
    }

    // Find tenants/lessees on this land
    let tenants: any[] = [];
    if (surname || firstName) {
      // Build OR conditions for tenant/lessee land owner name matching
      const nameParts = [surname, firstName].filter(Boolean);
      const namePattern = `%${nameParts.join("%")}%`;

      // Query rsbsa_farm_parcels for tenants/lessees whose land owner name matches
      const { data: tenantParcels } = await supabase
        .from("rsbsa_farm_parcels")
        .select(
          `
                    submission_id,
                    ownership_type_tenant,
                    ownership_type_lessee,
                    tenant_land_owner_name,
                    lessee_land_owner_name,
                    farm_location_barangay
                `,
        )
        .ilike("farm_location_barangay", barangay.trim())
        .or(
          `tenant_land_owner_name.ilike.${namePattern},lessee_land_owner_name.ilike.${namePattern}`,
        );

      if (tenantParcels && tenantParcels.length > 0) {
        const tenantIds = [
          ...new Set(tenantParcels.map((p: any) => p.submission_id)),
        ];
        const { data: tenantSubmissions } = await supabase
          .from("rsbsa_submission")
          .select(
            `
                        id,
                        "FIRST NAME",
                        "MIDDLE NAME",
                        "LAST NAME",
                        "BARANGAY",
                        "MAIN LIVELIHOOD",
                        "FARMER_RICE",
                        "FARMER_CORN",
                        "FARMER_OTHER_CROPS",
                        "FARMER_OTHER_CROPS_TEXT",
                        "FARMER_LIVESTOCK",
                        "FARMER_LIVESTOCK_TEXT",
                        "FARMER_POULTRY",
                        "FARMER_POULTRY_TEXT",
                        status,
                        created_at
                    `,
          )
          .in("id", tenantIds);

        if (tenantSubmissions) {
          tenants = tenantSubmissions.map((row: any) => {
            const parcel = tenantParcels.find(
              (p: any) => p.submission_id === row.id,
            );
            const farmerName = [
              row["FIRST NAME"],
              row["MIDDLE NAME"],
              row["LAST NAME"],
            ]
              .filter(Boolean)
              .join(" ");
            return {
              id: row.id,
              farmer_name: farmerName,
              barangay: row.BARANGAY,
              registration_date: row.created_at,
              ownership_status: parcel?.ownership_type_tenant
                ? "Tenant"
                : "Lessee",
              farmer_status: row.status,
              crops: buildCropsList(row),
            };
          });
        }
      }
    }

    // Fetch land history for this barangay
    let landHistory: any[] = [];
    const { data: historyData } = await supabase
      .from("land_history")
      .select("*")
      .ilike("farm_location_barangay", barangay.trim())
      .order("created_at", { ascending: true });

    if (historyData && historyData.length > 0) {
      // If we have the owner, filter to parcels matching this owner
      if (owner) {
        const ownerParcelHistory = historyData.filter((h: any) => {
          const nameMatch =
            (h.farmer_name || "")
              .toLowerCase()
              .includes(surname.toLowerCase()) ||
            (h.land_owner_name || "")
              .toLowerCase()
              .includes(surname.toLowerCase());
          return nameMatch;
        });
        landHistory =
          ownerParcelHistory.length > 0 ? ownerParcelHistory : historyData;
      } else {
        landHistory = historyData;
      }
    }

    return { owner, tenants, landHistory };
  } catch (err) {
    console.error("Error in getCropPlantingInfo:", err);
    return { owner: null, tenants: [], landHistory: [] };
  }
};

export const getLandPlotById = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("land_plots")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return createResponse(null, error.message, 404);
  return createResponse(data, null, 200);
};

const normalizeLandPlotPayloadForSupabase = (payload: any) => {
  if (!payload || typeof payload !== "object") return payload;

  return {
    id: payload.id,
    name: payload.name,
    ffrs_id: payload.ffrs_id,
    area: payload.area,
    coordinate_accuracy:
      payload.coordinate_accuracy ?? payload.coordinateAccuracy,
    barangay: payload.barangay,
    first_name: payload.first_name ?? payload.firstName,
    middle_name: payload.middle_name ?? payload.middleName,
    surname: payload.surname,
    ext_name: payload.ext_name,
    gender: payload.gender,
    municipality: payload.municipality,
    province: payload.province,
    parcel_address: payload.parcel_address,
    status: payload.status,
    street: payload.street,
    farm_type: payload.farm_type ?? payload.farmType,
    plot_source: payload.plot_source ?? payload.plotSource,
    parcel_number: payload.parcel_number ?? payload.parcelNumber,
    geometry: payload.geometry,
    created_at: payload.created_at ?? payload.createdAt,
    updated_at: payload.updated_at ?? payload.updatedAt,
  };
};

const getCurrentAuditUser = () => {
  try {
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      id: currentUser.id,
      name: currentUser.name || currentUser.username || "Anonymous",
      role:
        currentUser.role || localStorage.getItem("userRole") || "technician",
    };
  } catch {
    return {
      id: null,
      name: "Anonymous",
      role: localStorage.getItem("userRole") || "technician",
    };
  }
};

const buildLandPlotAuditSummary = (plot: any) => ({
  geometry_type:
    plot?.geometry && typeof plot.geometry === "object"
      ? plot.geometry.type
      : null,
  area: plot?.area ?? null,
  barangay: plot?.barangay ?? null,
  coordinate_accuracy:
    plot?.coordinate_accuracy ?? plot?.coordinateAccuracy ?? null,
});

const logLandPlotCreateAudit = async (createdPlot: any) => {
  try {
    const user = getCurrentAuditUser();
    const auditLogger = getAuditLogger();

    await auditLogger.logCRUD(
      {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      "CREATE",
      AuditModule.LAND_PLOTS,
      "land_plots",
      createdPlot?.id || "unknown",
      `Technician created land geometry on Land Registry page (plot ${createdPlot?.id || "unknown"})`,
      undefined,
      buildLandPlotAuditSummary(createdPlot),
      {
        includeRouteContext: false,
        metadata: null,
      },
    );
  } catch (auditError) {
    console.error("Land plot audit log failed (non-blocking):", auditError);
  }
};

export const createLandPlot = async (plotData: any): Promise<ApiResponse> => {
  try {
    const payload = normalizeLandPlotPayloadForSupabase(plotData);
    const { data, error } = await supabase
      .from("land_plots")
      .insert([payload])
      .select()
      .single();

    if (error) return createResponse(null, error.message, 500);

    await logLandPlotCreateAudit(data);
    return createResponse(data, null, 201);
  } catch (error: any) {
    return createResponse(
      null,
      error?.message || "Failed to create land plot",
      500,
    );
  }
};

export const updateLandPlot = async (
  id: string | number,
  updateData: any,
): Promise<ApiResponse> => {
  try {
    const payload = normalizeLandPlotPayloadForSupabase(updateData);
    const { data, error } = await supabase
      .from("land_plots")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
  } catch (error: any) {
    return createResponse(
      null,
      error?.message || "Failed to update land plot",
      500,
    );
  }
};

export const deleteLandPlot = async (
  id: string | number,
): Promise<ApiResponse> => {
  try {
    const { error } = await supabase.from("land_plots").delete().eq("id", id);
    if (error) return createResponse(null, error.message, 500);

    return createResponse({ success: true }, null, 200);
  } catch (error: any) {
    return createResponse(
      null,
      error?.message || "Failed to delete land plot",
      500,
    );
  }
};

// ==================== DISTRIBUTION ALLOCATIONS ====================

export interface FertilizerCatalogItem {
  id: number;
  code: string;
  name: string;
  n_pk: string | null;
  default_unit: string;
  is_active: boolean;
  display_order: number;
}

export interface SeedCatalogItem {
  id: number;
  variety_code: string;
  name: string;
  default_unit: string;
  is_active: boolean;
  display_order: number;
}

export const getFertilizerCatalog = async (): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("fertilizer_catalog")
    .select("id, code, name, n_pk, default_unit, is_active, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data || [], null, 200);
};

export const getSeedCatalog = async (): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("seed_catalog")
    .select("id, variety_code, name, default_unit, is_active, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data || [], null, 200);
};

// ==================== SHORTAGES SUGGESTIONS ====================

type FertilizerShortagePayload = {
  seedId: string | null;
  shortageFertId: string;
  unavailableIds?: string[];
};

type SeedShortagePayload = {
  seedId: string;
  unavailableIds?: string[];
};

const SHORTAGES_API_COOLDOWN_MS = 30_000;
let shortagesApiCooldownUntil = 0;

const USE_SUPABASE_SHORTAGES =
  String(import.meta.env.VITE_USE_SUPABASE_SHORTAGES || "").toLowerCase() ===
  "true";

const SUPABASE_SHORTAGES_RPC = {
  listSeeds: "list_shortages_seeds",
  listFertilizers: "list_shortages_fertilizers",
  resolveFertilizer: "resolve_fertilizer_shortage",
  resolveSeed: "resolve_seed_shortage",
} as const;

const mapSupabaseShortagesError = (error: any): string => {
  const message =
    error?.message ||
    error?.details ||
    error?.hint ||
    "Supabase shortages request failed.";
  return String(message);
};

const callShortagesSupabase = async (
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse> => {
  try {
    if (path === "/seeds") {
      const { data, error } = await supabase.rpc(
        SUPABASE_SHORTAGES_RPC.listSeeds,
      );
      if (error)
        return createResponse(null, mapSupabaseShortagesError(error), 500);
      return createResponse(data ?? [], null, 200);
    }

    if (path === "/fertilizers") {
      const { data, error } = await supabase.rpc(
        SUPABASE_SHORTAGES_RPC.listFertilizers,
      );
      if (error)
        return createResponse(null, mapSupabaseShortagesError(error), 500);
      return createResponse(data ?? [], null, 200);
    }

    if (path === "/fertilizer") {
      const { data, error } = await supabase.rpc(
        SUPABASE_SHORTAGES_RPC.resolveFertilizer,
        {
          seed_id: body?.seedId ?? null,
          shortage_fert_id: body?.shortageFertId,
          unavailable_ids: Array.isArray(body?.unavailableIds)
            ? body?.unavailableIds
            : [],
        },
      );
      if (error)
        return createResponse(null, mapSupabaseShortagesError(error), 500);
      return createResponse(data, null, 200);
    }

    if (path === "/seed") {
      const { data, error } = await supabase.rpc(
        SUPABASE_SHORTAGES_RPC.resolveSeed,
        {
          seed_id: body?.seedId,
          unavailable_ids: Array.isArray(body?.unavailableIds)
            ? body?.unavailableIds
            : [],
        },
      );
      if (error)
        return createResponse(null, mapSupabaseShortagesError(error), 500);
      return createResponse(data, null, 200);
    }

    return createResponse(null, `Unsupported shortages path: ${path}`, 400);
  } catch (error: any) {
    return createResponse(
      null,
      error?.message || "Unable to connect to Supabase shortages RPC.",
      500,
    );
  }
};

const callShortagesApiViaNode = async (
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse> => {
  const now = Date.now();
  if (now < shortagesApiCooldownUntil) {
    const secondsLeft = Math.ceil((shortagesApiCooldownUntil - now) / 1000);
    return createResponse(
      null,
      `Shortages API is temporarily unavailable. Retrying automatically in ${secondsLeft}s.`,
      503,
    );
  }

  try {
    const response = await fetch(`/api/shortages${path}`, {
      method: body ? "POST" : "GET",
      headers: body
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response
      .json()
      .catch(() => ({ error: "Invalid JSON response from shortages API." }));

    if (!response.ok) {
      const errorMessage =
        payload?.error || payload?.message || "Shortages API request failed.";

      if (
        response.status >= 500 &&
        typeof payload?.error === "string" &&
        /invalid json response from shortages api|proxy|econnrefused/i.test(
          payload.error,
        )
      ) {
        shortagesApiCooldownUntil = Date.now() + SHORTAGES_API_COOLDOWN_MS;
      }

      return createResponse(null, errorMessage, response.status);
    }

    shortagesApiCooldownUntil = 0;
    return createResponse(payload, null, response.status || 200);
  } catch (error: any) {
    shortagesApiCooldownUntil = Date.now() + SHORTAGES_API_COOLDOWN_MS;
    return createResponse(
      null,
      error?.message || "Unable to connect to shortages API.",
      500,
    );
  }
};

export const getShortagesSeeds = async (): Promise<ApiResponse> => {
  if (!USE_SUPABASE_SHORTAGES) {
    return callShortagesApiViaNode("/seeds");
  }

  const supabaseResponse = await callShortagesSupabase("/seeds");
  if (!supabaseResponse.error) {
    return supabaseResponse;
  }

  return callShortagesApiViaNode("/seeds");
};

export const getShortagesFertilizers = async (): Promise<ApiResponse> => {
  if (!USE_SUPABASE_SHORTAGES) {
    return callShortagesApiViaNode("/fertilizers");
  }

  const supabaseResponse = await callShortagesSupabase("/fertilizers");
  if (!supabaseResponse.error) {
    return supabaseResponse;
  }

  return callShortagesApiViaNode("/fertilizers");
};

export const resolveFertilizerShortageSuggestion = async (
  payload: FertilizerShortagePayload,
): Promise<ApiResponse> => {
  if (!USE_SUPABASE_SHORTAGES) {
    return callShortagesApiViaNode("/fertilizer", payload);
  }

  const supabaseResponse = await callShortagesSupabase("/fertilizer", payload);
  if (!supabaseResponse.error) {
    return supabaseResponse;
  }

  return callShortagesApiViaNode("/fertilizer", payload);
};

export const resolveSeedShortageSuggestion = async (
  payload: SeedShortagePayload,
): Promise<ApiResponse> => {
  if (!USE_SUPABASE_SHORTAGES) {
    return callShortagesApiViaNode("/seed", payload);
  }

  const supabaseResponse = await callShortagesSupabase("/seed", payload);
  if (!supabaseResponse.error) {
    return supabaseResponse;
  }

  return callShortagesApiViaNode("/seed", payload);
};

export const getAllocations = async (): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("regional_allocations")
    .select("*");

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const getAllocationById = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("regional_allocations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return createResponse(null, error.message, 404);
  return createResponse(data, null, 200);
};

export const getAllocationBySeason = async (
  season: string,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("regional_allocations")
    .select("*")
    .eq("season", season)
    .single();

  if (error) return createResponse(null, error.message, 404);
  return createResponse(data, null, 200);
};

export const createAllocation = async (
  allocationData: any,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("regional_allocations")
    .insert(allocationData)
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation (shouldn't happen after removing constraint)
    if (error.code === "23505") {
      return createResponse(
        null,
        `Duplicate allocation detected. Please check existing allocations.`,
        409,
      );
    }
    return createResponse(null, error.message, 500);
  }
  return createResponse(data, null, 201);
};

export const updateAllocation = async (
  id: string | number,
  updateData: any,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("regional_allocations")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const deleteAllocation = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { error } = await supabase
    .from("regional_allocations")
    .delete()
    .eq("id", id);

  if (error) return createResponse(null, error.message, 500);
  return createResponse({ success: true }, null, 200);
};

// ==================== FARMER REQUESTS ====================

export const getFarmerRequests = async (
  seasonOrAllocationId?: string | number,
  isAllocationId: boolean = false,
): Promise<ApiResponse> => {
  let query = supabase.from("farmer_requests").select("*");

  if (seasonOrAllocationId !== undefined) {
    if (isAllocationId) {
      // Filter by specific allocation ID
      query = query.eq("allocation_id", seasonOrAllocationId);
    } else {
      // Legacy: filter by season
      query = query.eq("season", seasonOrAllocationId);
    }
  }

  const { data, error } = await query;

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const getFarmerRequestsByAllocationId = async (
  allocationId: string | number,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("farmer_requests")
    .select("*")
    .eq("allocation_id", allocationId);

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const getFarmerRequestById = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("farmer_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return createResponse(null, error.message, 404);
  return createResponse(data, null, 200);
};

export const createFarmerRequest = async (
  requestData: any,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("farmer_requests")
    .insert(requestData)
    .select()
    .single();

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 201);
};

export const updateFarmerRequest = async (
  id: string | number,
  updateData: any,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("farmer_requests")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const deleteFarmerRequest = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { error } = await supabase
    .from("farmer_requests")
    .delete()
    .eq("id", id);

  if (error) return createResponse(null, error.message, 500);
  return createResponse({ success: true }, null, 200);
};

// ==================== DISTRIBUTION RECORDS ====================

export const getDistributionRecords = async (): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("distribution_records")
    .select("*");

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const createDistributionRecord = async (
  recordData: any,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("distribution_records")
    .insert(recordData)
    .select()
    .single();

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 201);
};

// ==================== LAND OWNERS ====================

export const getLandOwners = async (): Promise<ApiResponse> => {
  // Get registered owners from rsbsa_submission
  // The column name in rsbsa_submission is OWNERSHIP_TYPE_REGISTERED_OWNER
  const { data, error } = await supabase
    .from("rsbsa_submission")
    .select(
      'id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "BARANGAY", "MUNICIPALITY"',
    )
    .eq("OWNERSHIP_TYPE_REGISTERED_OWNER", true);

  if (error) {
    console.error("getLandOwners error:", error);
    return createResponse(null, error.message, 500);
  }

  // Transform to expected format with full name
  const landOwners = (data || []).map((row: any) => ({
    id: row.id,
    name: `${row["FIRST NAME"] || ""} ${row["MIDDLE NAME"] || ""} ${row["LAST NAME"] || ""}`
      .replace(/\s+/g, " ")
      .trim(),
    barangay: row["BARANGAY"] || "",
    municipality: row["MUNICIPALITY"] || "Dumangas",
  }));

  return createResponse(landOwners, null, 200);
};

// ==================== LAND HISTORY ====================

export const getLandHistory = async (
  landPlotId?: string | number,
): Promise<ApiResponse> => {
  let query = supabase.from("land_history").select("*");

  if (landPlotId) {
    query = query.eq("land_plot_id", landPlotId);
  }

  const { data, error } = await query;

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

// ==================== USERS ====================

export const getUsers = async (): Promise<ApiResponse> => {
  const { data, error } = await supabase.from("users").select("*");

  if (error) return createResponse(null, error.message, 500);
  return createResponse(data, null, 200);
};

export const getUserById = async (
  id: string | number,
): Promise<ApiResponse> => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return createResponse(null, error.message, 404);
  return createResponse(data, null, 200);
};

// ==================== UNIVERSAL API FETCH ====================

/**
 * Universal fetch replacement - automatically routes to Supabase
 * Use this as a drop-in replacement for fetch('http://localhost:5000/api/...')
 */
export const apiFetch = async (
  url: string,
  options?: RequestInit,
): Promise<any> => {
  const method = options?.method || "GET";
  const body = options?.body ? JSON.parse(options.body as string) : null;

  // Parse the URL to extract endpoint and params
  const urlPath = url
    .replace("http://localhost:5000", "")
    .replace(/^\/api\//, "");
  const parts = urlPath.split("/");

  console.log("🔄 API Fetch intercepted:", { url, method, parts });

  // Route to appropriate Supabase function
  try {
    // RSBSA Submission routes
    if (parts[0] === "rsbsa_submission") {
      if (parts.length === 1) {
        if (method === "GET") return getRsbsaSubmissions();
        if (method === "POST") return createRsbsaSubmission(body);
      }
      if (parts.length === 2) {
        const id = parts[1];
        if (method === "GET") return getRsbsaSubmissionById(id);
        if (method === "PUT") return updateRsbsaSubmission(id, body);
        if (method === "DELETE") return deleteRsbsaSubmission(id);
      }
      if (parts.length === 3 && parts[2] === "parcels") {
        return getFarmParcels(parts[1]);
      }
    }

    // Land plots routes
    if (parts[0] === "land-plots") {
      if (parts.length === 1) {
        if (method === "GET") return getLandPlots();
        if (method === "POST") return createLandPlot(body);
      }
      if (parts.length === 2) {
        const id = parts[1];
        if (method === "GET") return getLandPlotById(id);
        if (method === "PUT") return updateLandPlot(id, body);
        if (method === "DELETE") return deleteLandPlot(id);
      }
    }

    // Distribution routes
    if (parts[0] === "distribution") {
      if (parts[1] === "allocations") {
        if (parts.length === 2) {
          if (method === "GET") return getAllocations();
          if (method === "POST") return createAllocation(body);
        }
        if (parts.length === 3) {
          const id = parts[2];
          if (method === "GET") return getAllocationById(id);
          if (method === "PUT") return updateAllocation(id, body);
        }
      }
      if (parts[1] === "requests") {
        if (parts.length === 2) {
          if (method === "GET") return getFarmerRequests();
          if (method === "POST") return createFarmerRequest(body);
        }
        if (parts.length === 3) {
          const idOrSeason = parts[2];
          if (method === "GET") {
            // Check if it's a season or ID
            if (isNaN(Number(idOrSeason))) {
              return getFarmerRequests(idOrSeason);
            }
            return getFarmerRequestById(idOrSeason);
          }
          if (method === "PUT") return updateFarmerRequest(idOrSeason, body);
          if (method === "DELETE") return deleteFarmerRequest(idOrSeason);
        }
      }
      if (parts[1] === "records") {
        if (method === "GET") return getDistributionRecords();
        if (method === "POST") return createDistributionRecord(body);
      }
      if (parts[1] === "catalog") {
        if (parts[2] === "fertilizers" && method === "GET") {
          return getFertilizerCatalog();
        }
        if (parts[2] === "seeds" && method === "GET") {
          return getSeedCatalog();
        }
      }
    }

    // Landowners route
    if (parts[0] === "landowners") {
      return getLandOwners();
    }

    // Land history route
    if (parts[0] === "land-history") {
      if (parts.length === 2) {
        return getLandHistory(parts[1]);
      }
      return getLandHistory();
    }

    // Users route
    if (parts[0] === "users") {
      if (parts.length === 1) return getUsers();
      if (parts.length === 2) return getUserById(parts[1]);
    }

    console.warn("⚠️ Unhandled API route:", url);
    return createResponse(null, `Unhandled route: ${url}`, 404);
  } catch (error: any) {
    console.error("❌ API Fetch error:", error);
    return createResponse(null, error.message, 500);
  }
};

// Export default for easy importing
export default {
  // RSBSA
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  createRsbsaSubmission,
  updateRsbsaSubmission,
  deleteRsbsaSubmission,

  // Farm Parcels
  getFarmParcels,
  createFarmParcel,
  updateFarmParcel,

  // Land Plots
  getLandPlots,
  getLandPlotById,
  createLandPlot,
  updateLandPlot,
  deleteLandPlot,
  getCropPlantingInfo,

  // Allocations
  getFertilizerCatalog,
  getSeedCatalog,
  getShortagesSeeds,
  getShortagesFertilizers,
  resolveFertilizerShortageSuggestion,
  resolveSeedShortageSuggestion,
  getAllocations,
  getAllocationById,
  getAllocationBySeason,
  createAllocation,
  updateAllocation,
  deleteAllocation,

  // Farmer Requests
  getFarmerRequests,
  getFarmerRequestsByAllocationId,
  getFarmerRequestById,
  createFarmerRequest,
  updateFarmerRequest,
  deleteFarmerRequest,

  // Distribution Records
  getDistributionRecords,
  createDistributionRecord,

  // Land Owners
  getLandOwners,

  // Land History
  getLandHistory,

  // Users
  getUsers,
  getUserById,

  // Dashboard
  getDashboardStats,
  getMonthlyTrends,
  getRecentActivity,
  getAvailableSeasons,

  // Technician Dashboard
  getTechDashboardData,

  // Universal fetch
  apiFetch,
};
