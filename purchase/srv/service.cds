using { purchase as db } from '../db/schema';


@path: '/purchase'
service PurchaseService {

    entity PurchaseRequests
        as projection on db.PurchaseRequests;

    entity PurchaseRequestItems
        as projection on db.PurchaseRequestItems;

    entity StatusHistories
        as projection on db.StatusHistories;

    entity Notifications
        as projection on db.Notifications;

    entity Attachments
        as projection on db.Attachments;


    /* =====================================================
       CUSTOM ACTIONS
       ===================================================== */

    action submitRequest(ID : UUID);

    action approveRequest(
        ID : UUID,
        comments : String(500)
    );

    action rejectRequest(
        ID : UUID,
        comments : String(500)
    );

    action cancelRequest(
        ID : UUID,
        comments : String(500)
    );
}