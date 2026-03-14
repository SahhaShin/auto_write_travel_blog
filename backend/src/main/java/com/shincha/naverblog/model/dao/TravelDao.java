package com.shincha.naverblog.model.dao;

import com.shincha.naverblog.model.dto.*;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface TravelDao {

    // ── TravelTrip ──────────────────────────────────
    void insertTrip(TravelTrip trip);
    List<TravelTrip> findTripsByUserId(@Param("userId") Long userId);
    TravelTrip findTripById(@Param("id") Long id, @Param("userId") Long userId);
    void updateTrip(TravelTrip trip);
    void deleteTrip(@Param("id") Long id, @Param("userId") Long userId);

    // ── TravelItinerary ─────────────────────────────
    void insertItinerary(TravelItinerary item);
    void insertItineraryBatch(@Param("list") List<TravelItinerary> list);
    List<TravelItinerary> findItineraryByTripId(@Param("tripId") Long tripId);
    void updateItinerary(TravelItinerary item);
    void deleteItinerary(@Param("id") Long id);
    void deleteItineraryByTripId(@Param("tripId") Long tripId);

    // ── TravelChecklist ─────────────────────────────
    void insertChecklist(TravelChecklist item);
    void insertChecklistBatch(@Param("list") List<TravelChecklist> list);
    List<TravelChecklist> findChecklistByTripId(@Param("tripId") Long tripId);
    void updateChecklistStatus(@Param("id") Long id, @Param("status") String status);
    void updateChecklistItem(TravelChecklist item);
    void deleteChecklist(@Param("id") Long id);

    // ── TravelExpense ────────────────────────────────
    void insertExpense(TravelExpense expense);
    List<TravelExpense> findExpensesByTripId(@Param("tripId") Long tripId);
    void updateExpense(TravelExpense expense);
    void deleteExpense(@Param("id") Long id);
}
