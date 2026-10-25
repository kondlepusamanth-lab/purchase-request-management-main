namespace purchase;

using {
    cuid,
    managed
} from '@sap/cds/common';


/* =========================================================
   PURCHASE REQUEST HEADER
   ========================================================= */

entity PurchaseRequests : cuid, managed {

    purchaseRequestNumber : String(20) @readonly;

    requesterName         : String(100) not null;

    department            : String(30) not null;

    requestDate           : Date not null;

    currency              : String(3) default 'INR';

    totalAmount           : Decimal(15,2) default 0;

    status                : String(20) default 'Draft';

    approverLevel         : String(30);

    approver              : String(100);

    approvalComments      : String(500);

    rejectionComments     : String(500);

    cancelledComments     : String(500);

    approvedBy            : String(100);

    approvedAt            : Timestamp;

    rejectedBy            : String(100);

    rejectedAt            : Timestamp;

    items : Composition of many PurchaseRequestItems
        on items.purchaseRequest = $self;

    history : Composition of many StatusHistories
        on history.purchaseRequest = $self;

    notifications : Composition of many Notifications
        on notifications.purchaseRequest = $self;

    attachments : Composition of many Attachments
        on attachments.purchaseRequest = $self;
}


/* =========================================================
   PURCHASE REQUEST ITEMS
   ========================================================= */

entity PurchaseRequestItems : cuid {

    materialNumber : String(40) not null;

    description : String(255) not null;

    quantity : Decimal(13,3) not null;

    unitPrice : Decimal(15,2) not null;

    netAmount : Decimal(15,2);

    taxPercent : Decimal(5,2) default 18;

    taxAmount : Decimal(15,2);

    grossAmount : Decimal(15,2);

    totalPrice : Decimal(15,2);

    purchaseRequest : Association to PurchaseRequests;
}


/* =========================================================
   STATUS HISTORY
   ========================================================= */

entity StatusHistories : cuid {

    requestNumber : String(20);

    oldStatus : String(20);

    newStatus : String(20);

    user : String(100);

    timestamp : Timestamp;

    purchaseRequest : Association to PurchaseRequests;
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

entity Notifications : cuid, managed {

    requestNumber : String(20);

    notificationType : String(30);

    message : String(500);

    recipient : String(100);

    isRead : Boolean default false;

    purchaseRequest : Association to PurchaseRequests;
}


/* =========================================================
   ATTACHMENTS
   ========================================================= */

entity Attachments : cuid, managed {

    fileName : String(255);

    mediaType : String(100);

    fileSize : Integer64;

    content : LargeBinary;

    purchaseRequest : Association to PurchaseRequests;
}


/* =========================================================
   NUMBER RANGE
   ========================================================= */

entity NumberRanges {

    key year : Integer;

    lastNumber : Integer default 0;
