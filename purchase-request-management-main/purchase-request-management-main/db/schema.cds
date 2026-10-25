using {
    cuid,
    managed
} from '@sap/cds/common';


namespace pr;

entity PurchaseRequests : cuid, managed {

    requestNumber       : String(20);

    requesterName       : String(100);

    department          : Association to Departments;

    requestDate         : Date;

    currency            : String(4);

    totalAmount         : Decimal(15, 2) @Core.Computed;

    status              : String(20) default 'Draft';

    approver            : String(100)    @Core.Computed;

    approvalComments    : String(500);

    rejectionComments   : String(500);

    virtual hideSubmit  : Boolean;
    virtual hideApprove : Boolean;
    virtual hideReject  : Boolean;
    virtual canCancel   : Boolean;

    items               : Composition of many PurchaseRequestItems
                              on items.request = $self;


    auditLogs           : Composition of many AuditLogs
                              on auditLogs.request = $self;
}

entity PurchaseRequestItems : cuid {

    request        : Association to PurchaseRequests;

    materialNumber : String(50);

    description    : String(500);

    quantity       : Integer;

    unitPrice      : Decimal(15, 2);

    netAmount      : Decimal(15, 2);

    taxAmount      : Decimal(15, 2);

    grossAmount    : Decimal(15, 2);
}

entity Departments {
    key code : String(20);
        name : String(100);
}

entity Currencies {
    key code : String(5);
        name : String(50);
}

entity AuditLogs : cuid, managed {

    request       : Association to PurchaseRequests;

    requestNumber : String(20);

    action        : String(30);

    oldStatus     : String(20);

    newStatus     : String(20);

    performedBy   : String(100);

    performedRole : String(50);

    remarks       : String(500);

    eventTime     : Timestamp;

}
