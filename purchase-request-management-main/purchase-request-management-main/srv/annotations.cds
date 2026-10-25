using PurchaseService from '../srv/purchase-service';

annotate PurchaseService.PurchaseRequests with @(
    UI.LineItem               : [
        {Value: requestNumber},
        {Value: requesterName},
        {Value: department_code},
        {Value: currency},
        {Value: requestDate},
        {Value: totalAmount},
        {Value: status},
        {Value: approver}
    ],

    UI.FieldGroup #GeneralInfo: {Data: [
        {Value: requestNumber},
        {Value: requesterName},
        {Value: department_code},
        {Value: requestDate},
        {Value: currency},
        {Value: totalAmount},
        {Value: status},
        {Value: approver}
    ]},

    UI.Facets                 : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'General Information',
            Target: '@UI.FieldGroup#GeneralInfo'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Items',
            Target: 'items/@UI.LineItem'
        },

        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Attachments',
            Target: 'attachments/@UI.LineItem'
        },

        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Audit Logs',
            Target: 'auditLogs/@UI.LineItem'
        }
    ],

    UI.Identification         : [
        {Value: requestNumber},
        {Value: requesterName},
        {Value: department.code},

        {
            $Type        : 'UI.DataFieldForAction',
            Action       : 'PurchaseService.submit',
            Label        : 'Submit',
            ![@UI.Hidden]: hideSubmit
        },
        {
            $Type        : 'UI.DataFieldForAction',
            Action       : 'PurchaseService.approve',
            Label        : 'Approve',
            ![@UI.Hidden]: hideApprove
        },
        {
            $Type        : 'UI.DataFieldForAction',
            Action       : 'PurchaseService.reject',
            Label        : 'Reject',
            ![@UI.Hidden]: hideReject
        },
        {
            $Type                      : 'UI.DataFieldForAction',
            Action                     : 'PurchaseService.cancelRequest',
            Label                      : 'Cancel Request',
            ![@Core.OperationAvailable]: canCancel
        }

    ]

) {
    requesterName
    @mandatory;

    department_code
    @mandatory;

    requestDate
    @mandatory;

    currency
    @mandatory;
};

annotate PurchaseService.PurchaseRequestItems with @(UI.LineItem: [
    {Value: materialNumber},
    {Value: description},
    {Value: quantity},
    {Value: unitPrice},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount}
]) {
    materialNumber @mandatory;
    description    @mandatory;
    quantity       @mandatory;
    unitPrice      @mandatory;
};

annotate PurchaseService.PurchaseRequests with {
    requestNumber     @Common.Label: 'Request Number';
    requesterName     @Common.Label: 'Requester Name';
    department        @Common.Label: 'Department';
    requestDate       @Common.Label: 'Request Date';
    currency          @Common.Label: 'Currency';
    totalAmount       @Common.Label: 'Total Amount';
    status            @Common.Label: 'Status';
    approver          @Common.Label: 'Approver';
    approvalComments  @Common.Label: 'Approval Comments';
    rejectionComments @Common.Label: 'Rejection Comments';
};

annotate PurchaseService.PurchaseRequestItems with {
    materialNumber @Common.Label: 'Material Number';
    description    @Common.Label: 'Description';
    quantity       @Common.Label: 'Quantity';
    unitPrice      @Common.Label: 'Unit Price';
    netAmount      @Common.Label: 'Net Amount';
    taxAmount      @Common.Label: 'Tax Amount';
    grossAmount    @Common.Label: 'Gross Amount';
};


annotate PurchaseService.PurchaseRequests with {

    requestNumber @Core.Computed;
    totalAmount   @Core.Computed;
    status        @Core.Computed;
    approver      @Core.Computed;

};

annotate PurchaseService.PurchaseRequests with {

    department @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList               : {
            CollectionPath: 'Departments',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: department_code,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );

};

annotate PurchaseService.PurchaseRequests with {

    currency @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList               : {
            CollectionPath: 'Currencies',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterInOut',
                    LocalDataProperty: currency,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name'
                }
            ]
        }
    );

};

annotate PurchaseService.PurchaseRequestItems with @(

    UI.FieldGroup #General: {Data: [
        {Value: materialNumber},
        {Value: description},
        {Value: quantity},
        {Value: unitPrice},
        {Value: netAmount},
        {Value: taxAmount},
        {Value: grossAmount}
    ]},

    UI.Facets             : [{
        $Type : 'UI.ReferenceFacet',
        Label : 'Item Details',
        Target: '@UI.FieldGroup#General'
    }]
);

annotate PurchaseService.PurchaseRequestItems with {
    netAmount   @Core.Computed;
    taxAmount   @Core.Computed;
    grossAmount @Core.Computed;
};

annotate PurchaseService.PurchaseRequests with actions {
    submit @(
        Common.SideEffects.TargetProperties: [
            'in/status',
            'in/hideSubmit',
            'in/hideApprove',
            'in/hideReject'
        ],
        TargetEntities : [auditLogs]
    );

};

annotate PurchaseService.PurchaseRequests with actions {

    approve @(Common.SideEffects.TargetProperties: [
        'in/status',
        'in/hideSubmit',
        'in/hideApprove',
        'in/hideReject'
    ],
            TargetEntities : [
                auditLogs
            ]);

};

annotate PurchaseService.PurchaseRequests with actions {

    reject @(Common.SideEffects.TargetProperties: [
        'in/status',
        'in/hideSubmit',
        'in/hideApprove',
        'in/hideReject'
    ],
            TargetEntities : [
                auditLogs
            ]);

};

annotate PurchaseService.PurchaseRequests with actions {

    cancelRequest @(Common.SideEffects.TargetProperties: ['in/status']);

};


annotate PurchaseService.PurchaseRequests with actions {

    submit        @(Core.OperationAvailable: {$edmJson: {$And: [
        {$Ne: [
            {$Path: 'in/requestNumber'},
            null
        ]},
        {$Eq: [
            {$Path: 'in/status'},
            'Draft'
        ]}
    ]}});

    approve       @(Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/status'},
        'Submitted'
    ]}});

    reject        @(Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/status'},
        'Submitted'
    ]}});

    cancelRequest @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/status'},
            'Draft'
        ]},
        {$Eq: [
            {$Path: 'in/status'},
            'Submitted'
        ]}
    ]}});

};

annotate PurchaseService.PurchaseRequests with @(UI.Facets: [

    {
        $Type : 'UI.ReferenceFacet',
        Label : 'General Information',
        Target: '@UI.FieldGroup#GeneralInfo'
    },

    {
        $Type : 'UI.ReferenceFacet',
        Label : 'Items',
        Target: 'items/@UI.LineItem'
    },

    {
        $Type : 'UI.ReferenceFacet',
        Label : 'Attachments',
        Target: 'attachments/@UI.LineItem'
    },

    {
        $Type : 'UI.ReferenceFacet',
        Label : 'Audit Logs',
        Target: 'auditLogs/@UI.LineItem'
    }

]);

annotate PurchaseService.PurchaseRequestAttachments with @(UI.LineItem: [
    {Value: fileName},
    {Value: mediaType},
    {Value: fileSize}
]);

annotate PurchaseService.AuditLogs with @(UI.LineItem: [

    {
        $Type: 'UI.DataField',
        Label: 'Date & Time',
        Value: eventTime
    },

    {
        $Type: 'UI.DataField',
        Label: 'Action',
        Value: action
    },

    {
        $Type: 'UI.DataField',
        Label: 'Old Status',
        Value: oldStatus
    },

    {
        $Type: 'UI.DataField',
        Label: 'New Status',
        Value: newStatus
    },

    {
        $Type: 'UI.DataField',
        Label: 'Performed By',
        Value: performedBy
    },

    {
        $Type: 'UI.DataField',
        Label: 'Role',
        Value: performedRole
    },

    {
        $Type: 'UI.DataField',
        Label: 'Remarks',
        Value: remarks
    }

]);

annotate PurchaseService.AuditLogs with {
    requestNumber @Common.Label: 'Request Number';

    eventTime     @Common.Label: 'Date & Time';

    action        @Common.Label: 'Action';

    oldStatus     @Common.Label: 'Old Status';

    newStatus     @Common.Label: 'New Status';

    performedBy   @Common.Label: 'Performed By';

    performedRole @Common.Label: 'Role';

    remarks       @Common.Label: 'Remarks';
};

annotate PurchaseService.AuditLogs with @(
    UI.CreateHidden: true,
    UI.DeleteHidden: true,
    UI.UpdateHidden: true
);

annotate PurchaseService.AuditLogs with @UI.Identification: [

    {
        $Type: 'UI.DataField',
        Value: requestNumber
    },

    {
        $Type: 'UI.DataField',
        Value: action
    },

    {
        $Type: 'UI.DataField',
        Value: oldStatus
    },

    {
        $Type: 'UI.DataField',
        Value: newStatus
    },

    {
        $Type: 'UI.DataField',
        Value: performedBy
    },

    {
        $Type: 'UI.DataField',
        Value: performedRole
    },

    {
        $Type: 'UI.DataField',
        Value: eventTime
    },

    {
        $Type: 'UI.DataField',
        Value: remarks
    }

];

annotate PurchaseService.AuditLogs with @UI.FieldGroup #General: {

Data: [

    {
        $Type: 'UI.DataField',
        Value: requestNumber
    },

    {
        $Type: 'UI.DataField',
        Value: action
    },

    {
        $Type: 'UI.DataField',
        Value: oldStatus
    },

    {
        $Type: 'UI.DataField',
        Value: newStatus
    },

    {
        $Type: 'UI.DataField',
        Value: performedBy
    },

    {
        $Type: 'UI.DataField',
        Value: performedRole
    },

    {
        $Type: 'UI.DataField',
        Value: eventTime
    },

    {
        $Type: 'UI.DataField',
        Value: remarks
    }

]};

annotate PurchaseService.AuditLogs with @UI.Facets: [

{
    $Type : 'UI.ReferenceFacet',
    Label : 'Audit Details',
    Target: '@UI.FieldGroup#General'
}

];

annotate PurchaseService.AuditLogs with {
    newStatus @UI.LineItem: [{
        Value: newStatus,
        Criticality: criticality
    }];
};

annotate PurchaseService.PurchaseRequests with @UI.SelectionFields: [
    requestNumber,
    department_code,
    status,
    requestDate
];

annotate PurchaseService.PurchaseRequests with @UI.LineItem: [
    { Value: requestNumber },
    { Value: requesterName },
    { Value: department_code },
    { Value: requestDate },
    { Value: status },
    { Value: totalAmount }
];

annotate PurchaseService.PurchaseRequests with @Common.SideEffects : {
    TargetEntities : [
        auditLogs
    ]
};
