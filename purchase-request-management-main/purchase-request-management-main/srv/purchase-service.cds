using pr from '../db/schema';

@requires: 'authenticated-user'
service PurchaseService {
        @odata.draft.enabled
    entity PurchaseRequests           as projection on pr.PurchaseRequests
        actions {
            
            // @requires: 'Employee'
            action submit()                  returns PurchaseRequests;

            // @requires: ['Manager','SeniorManager','Director']
            action approve(comments: String) returns PurchaseRequests;

            // @requires: ['Manager','SeniorManager','Director']
            action reject(comments: String)  returns PurchaseRequests;

            // @requires: 'Employee'
            action cancelRequest()           returns PurchaseRequests;

        };

    entity PurchaseRequestItems       as projection on pr.PurchaseRequestItems;

    entity Departments                as projection on pr.Departments;

    entity Currencies                 as projection on pr.Currencies;

    entity AuditLogs                  as projection on pr.AuditLogs;
}
