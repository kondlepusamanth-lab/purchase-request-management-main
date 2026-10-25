const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {

    console.log("Purchase Service JS Loaded");



    const {
        PurchaseRequests,
        PurchaseRequestItems,
        AuditLogs
    } = this.entities;

    function getUserRole(req) {

        if (req.user.is('Director'))
            return 'Director';

        if (req.user.is('SeniorManager'))
            return 'Senior Manager';

        if (req.user.is('Manager'))
            return 'Manager';

        return 'Employee';
    }

    async function createAuditLog(req, data) {



        await INSERT.into(AuditLogs).entries({

            request_ID: data.requestID,

            requestNumber: data.requestNumber || "New",

            action: data.action,

            oldStatus: data.oldStatus || "New",

            newStatus: data.newStatus,

            performedBy: req?.user?.id || "anonymous",

            performedRole: data.role,

            remarks: data.remarks,

            eventTime: new Date()

        });

        return await SELECT.one
            .from(PurchaseRequests)
            .where({ ID: req.params[0].ID });

    }


    this.on('submit', async (req) => {

        console.log("User ID:", req.user.id);
        console.log("Employee?", req.user.is('Employee'));
        console.log("Manager?", req.user.is('Manager'));
        console.log("SeniorManager?", req.user.is('SeniorManager'));
        console.log("Director?", req.user.is('Director'));

        console.log("==================================");
        console.log("User ID:", req.user.id);
        console.log("Roles:", req.user.roles);
        console.log("Attributes:", req.user.attr);
        console.dir(req.user, { depth: null });
        console.log("==================================");


        const ID = req.params[0].ID;
        const request1 = await SELECT.one.from(PurchaseRequests).where({ ID });


        const items = await SELECT.from(PurchaseRequestItems)
            .where({ request_ID: ID });

        const materialNumbers = new Set();

        for (const item of items) {

            if (materialNumbers.has(item.materialNumber)) {
                return req.error(
                    `Duplicate Material Number '${item.materialNumber}' is not allowed.`
                );
            }

            materialNumbers.add(item.materialNumber);
        }

        console.log("------------------------------------------------------111111111111111111111111111111", request1);


        if (!request1)
            req.error(404, 'Purchase Request not found');
        else {

            if (req?.data?.requestNumber == null || req?.data?.requestNumber == undefined) {




                const ID = req.params[0].ID;

                const request = await SELECT.one.from(PurchaseRequests).where({ ID });


                if (!request)
                    req.error(404, 'Purchase Request not found');

                if (request.status !== 'Draft')
                    req.error('Only Draft requests can be submitted');

                await UPDATE(PurchaseRequests)
                    .set({
                        status: 'Submitted'
                    })
                    .where({ ID });

                await createAuditLog(req, {

                    requestID: ID,

                    requestNumber: request.requestNumber,

                    action: "SUBMITTED",

                    oldStatus: "Draft",

                    newStatus: "Submitted",

                    role: getUserRole(req),

                    remarks: "Submitted for approval"

                });


                request.status = 'Submitted';
                return request;
            }
            else {
                req.error('Request Number is not generated yet. Please try again.');
            }
        }
    });

    this.on('approve', async (req) => {

        const ID = req.params[0].ID;
        const comments = req.data.comments;

        const request = await SELECT.one
            .from(PurchaseRequests)
            .where({ ID });

        if (!request) {
            return req.error(404, 'Purchase Request not found');
        }

        // Only Submitted requests can be approved
        if (request.status !== 'Submitted') {
            return req.error(400, 'Only Submitted requests can be approved');
        }

        const amount = request.totalAmount;

        const isManager = req.user.is('Manager');
        const isSeniorManager = req.user.is('SeniorManager');
        const isDirector = req.user.is('Director');

        // Senior Manager and Director can approve ANY amount
        if (isSeniorManager || isDirector) {
            // allowed
        }

        // Manager can approve only up to 10,000
        else if (amount <= 10000 && isManager) {
            // allowed
        }

        // Nobody else is allowed
        else {
            return req.reject(
                403,
                'You do not have permission to approve this request.'
            );
        }

        await UPDATE(PurchaseRequests)
            .set({
                status: 'Approved',
                approvalComments: comments
            })
            .where({ ID });

        await createAuditLog(req, {
            requestID: ID,
            requestNumber: request.requestNumber,
            action: 'APPROVED',
            oldStatus: 'Submitted',
            newStatus: 'Approved',
            role: getUserRole(req),
            remarks: comments
        });

        return SELECT.one
            .from(PurchaseRequests)
            .where({ ID });
    });

    this.on('reject', async (req) => {

        const ID = req.params[0].ID;

        const comments = req.data.comments;

        const request = await SELECT.one.from(PurchaseRequests).where({ ID });

        if (request.status !== 'Submitted')
            req.error('Only Submitted requests can be rejected');

        await UPDATE(PurchaseRequests)
            .set({
                status: 'Rejected',
                rejectionComments: comments
            })
            .where({ ID });

        await createAuditLog(req, {

            requestID: ID,

            requestNumber: request.requestNumber,

            action: "REJECTED",

            oldStatus: "Submitted",

            newStatus: "Rejected",

            role: getUserRole(req),

            remarks: comments

        });
        return {
            message: "Purchase Request submitted successfully."
        };

    });

    this.on('cancelRequest', async (req) => {

        const ID = req.params[0].ID;

        const request = await SELECT.one
            .from(PurchaseRequests)
            .where({ ID });

        if (!request)
            req.error(404, "Purchase Request not found");

        if (
            request.status !== "Draft" &&
            request.status !== "Submitted"
        ) {
            req.error("Only Draft or Submitted requests can be cancelled.");
        }

        await UPDATE(PurchaseRequests)
            .set({
                status: "Cancelled"
            })
            .where({ ID });

        await createAuditLog(req, {

            requestID: ID,

            requestNumber: request.requestNumber,

            action: "CANCELLED",

            oldStatus: request.status,

            newStatus: "Cancelled",

            role: getUserRole(req),

            remarks: "Cancelled by requester"

        });

    });

    this.before('UPDATE', PurchaseRequests, async (req) => {
        console.log("=================================ttttttt", req.data,);


        await createAuditLog(req, {

            requestID: req.data.ID,

            requestNumber: req.data.requestNumber,

            action: "UPDATED",

            oldStatus: req.data.status,

            newStatus: req.data.status,

            role: getUserRole(req),

            remarks: "Purchase Request Updated"

        });

        const request = await SELECT.one
            .from(PurchaseRequests)
            .where({ ID: req.data.ID });

        var count = await SELECT.from(PurchaseRequestItems)

        console.log("=====================----------------------------=========================count", count);


        if (!request) return;

        if (request.status !== 'Draft') {
            req.error('Only Purchase Requests in Draft status can be edited.');
        }


    });

    this.before(['CREATE', 'UPDATE', 'DELETE'], PurchaseRequestItems, async (req) => {

        console.log("User:", req.user.id);
        console.log("Roles:", req.user._roles);

        const item = await SELECT.one
            .from(PurchaseRequestItems)
            .where({ ID: req.data.ID });

        const request = await SELECT.one
            .from(PurchaseRequests)
            .where({ ID: item.request_ID });

        if (
            request &&
            (request.status === 'Approved' ||
                request.status === 'Rejected')
        ) {
            req.error('Items cannot be modified after approval.');
        }

    });

    this.before('CREATE', 'PurchaseRequests', async (req) => {

        await createAuditLog(req, {
            requestID: req.data.ID,
            requestNumber: req.data.requestNumber,
            action: "CREATED",
            oldStatus: "",
            newStatus: "Draft",
            role: getUserRole(req),
            remarks: "Purchase Request Created"
        });

        const year = new Date().getFullYear();

        const lastRequest = await SELECT.one
            .from(PurchaseRequests)
            .columns('requestNumber')
            .orderBy('createdAt desc');

        let next = 1;

        if (lastRequest?.requestNumber) {
            const parts = lastRequest.requestNumber.split('-');
            next = parseInt(parts[2]) + 1;
        }

        req.data.requestNumber =
            `PR-${year}-${String(next).padStart(6, '0')}`;



        if ('quantity' in req.data) {

            if (req.data.quantity <= 0)
                req.error('Quantity must be greater than zero');

            if (req.data.quantity > 100)
                req.error('Quantity cannot exceed 100');
        }

        if ('unitPrice' in req.data) {

            if (req.data.unitPrice <= 0)
                req.error('Unit Price must be greater than zero');

            if (req.data.unitPrice >= 100000)
                req.error('Unit Price must be less than 100000');
        }

        if ('description' in req.data) {

            if (!req.data.description?.trim())
                req.error('Material Description is mandatory');

            if (req.data.description.trim().length < 10)
                req.error('Material Description must contain at least 10 characters');
        }
    });

    this.before(['CREATE', 'UPDATE'], PurchaseRequests, (req) => {

        console.log("1111111111111", req.data);


        console.log("User:", req.user.id);
        console.log("Roles:", req.user._roles);
        const items = req.data.items || [];

        if (items.length === 0) {
            req.error('At least one material is required.');
        }


        if (req.data.requestDate) {

            const today = new Date();
            const requestDate = new Date(req.data.requestDate);

            if (requestDate > today) {
                req.error('Request Date cannot be in future');
            }

            const diffDays =
                (today - requestDate) /
                (1000 * 60 * 60 * 24);

            if (diffDays > 30) {
                req.error('Request Date cannot be older than 30 days');
            }
        }

        if (req.data?.items) {

            for (const item of req.data.items) {

                console.log(item);

                if (item.quantity <= 0) {
                    req.error("Quantity must be greater than zero");
                }

                if (item.quantity > 100) {
                    req.error("Quantity cannot exceed 100");
                }

                if (item.unitPrice <= 0) {
                    req.error("Unit Price must be greater than zero");
                }

                if (item.unitPrice >= 100000) {
                    req.error("Unit Price must be less than 100000");
                }

                if (!item.description || item.description.trim().length < 10) {
                    req.error("Description must contain at least 10 characters");
                }

                const net = item.quantity * item.unitPrice;
                const tax = net * 0.18;

                item.netAmount = Number(net.toFixed(2));
                item.taxAmount = Number(tax.toFixed(2));
                item.grossAmount = Number((net + tax).toFixed(2));
            }
            let totalAmount = 0;

            for (const item of req.data.items || []) {

                const qty = Number(item.quantity || 0);
                const price = Number(item.unitPrice || 0);

                const net = qty * price;
                const tax = net * 0.18;
                const gross = net + tax;

                item.netAmount = Number(net.toFixed(2));
                item.taxAmount = Number(tax.toFixed(2));
                item.grossAmount = Number(gross.toFixed(2));

                totalAmount += gross;
            }

            req.data.totalAmount = Number(totalAmount.toFixed(2));
        }

        if (req.data.totalAmount !== undefined) {

            if (Number(req.data.totalAmount) <= 100) {
                req.error(
                    "Purchase Request Total Amount should be greater than ₹100."
                );
            }

        }

        if (req.data.items.length > 20) {
            req.error("A Purchase Request cannot contain more than 20 items.");
        }

        // Attachment Validation
        if (req.data.totalAmount > 100000) {

            // Check attachment exists
            if (!req.data.attachments || req.data.attachments.length === 0) {
                req.error("Supporting document attachment is mandatory for requests above ₹1,00,000.");
            }

            for (const file of req.data.attachments) {

                // Allowed file types
                const allowedTypes = [
                    "application/pdf",
                    "image/jpeg",
                    "image/png"
                ];

                if (!allowedTypes.includes(file.mimeType)) {
                    req.error(
                        `File '${file.filename}' is not allowed. Only PDF, JPG and PNG files are permitted.`
                    );
                }

                console.log(`================================================================================File '${file.size}' exceeds the maximum size of 10 MB.`);

                // Maximum size 10 MB
                // @cap-js/attachments stores the size in bytes
                if (file.size && file.size > 10 * 1024 * 1024) {


                    req.error(
                        `File '${file.filename}' exceeds the maximum size of 10 MB.`
                    );
                }
            }
        }

        if (req.data.totalAmount <= 10000) {
            req.data.approver = "Manager";
        }
        else if (req.data.totalAmount <= 50000) {
            req.data.approver = "Senior Manager";
        }
        else {
            req.data.approver = "Director";
        }
    });




    this.after("READ", PurchaseRequests, async (data) => {

        const rows = Array.isArray(data) ? data : [data];


        for (const r of rows) {

            r.hideSubmit = r.status !== "Draft";

            r.hideApprove = r.status !== "Submitted";

            r.hideReject = r.status !== "Submitted";

            r.canCancel =
                r.status === "Draft" ||
                r.status === "Submitted";
        }
    });

    this.before('READ', PurchaseRequests, async () => {

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() - 30);

        const requests = await SELECT.from(PurchaseRequests);
        console.log("================00000000000---------new", expiryDate, requests);


        for (const request of requests) {

            if (
                request.status === "Draft" &&
                new Date(request.requestDate) < expiryDate
            ) {

                await UPDATE(PurchaseRequests)
                    .set({
                        status: "Expired"
                    })
                    .where({
                        ID: request.ID
                    });

                console.log(
                    request.requestNo,
                    "changed to Expired"
                );
            }
        }

    });



    this.before(["UPDATE", "DELETE"], PurchaseRequestItems, async (req) => {

        const item = await SELECT.one
            .from(PurchaseRequestItems)
            .where({ ID: req.data.ID });

        if (!item) return;

        const request = await SELECT.one
            .from(PurchaseRequests)
            .where({ ID: item.request_ID });

        if (!request) return;

        if (request.status !== "Draft") {
            req.error("Items can only be modified when the Purchase Request is in Draft status.");
        }

    });

    // this.after("CREATE", PurchaseRequestItems, async (req) => {

    //     await createAuditLog(req, {
    //         requestID: data.ID,
    //         requestNumber: data.requestNumber
    //     });

    //     await createAuditLog(req, {

    //         requestID: request.ID,

    //         requestNumber: request.requestNumber,

    //         action: "ITEM_CREATED",

    //         oldStatus: request.status,

    //         newStatus: request.status,

    //         role: getUserRole(req),

    //         remarks: `Material ${data.materialNumber} added`

    //     });

    // });


    this.after("UPDATE", PurchaseRequestItems, async (req) => {

        const request = await SELECT.one
            .from(PurchaseRequests)
            .where({ ID: data.request_ID });

        await createAuditLog(req, {

            requestID: request.ID,

            requestNumber: request.requestNumber,

            action: "ITEM_UPDATED",

            oldStatus: request.status,

            newStatus: request.status,

            role: getUserRole(req),

            remarks: `Material ${data.materialNumber} updated`

        });

    });

    this.before("DELETE", PurchaseRequestItems, async (req) => {

        const item = await SELECT.one
            .from(PurchaseRequestItems)
            .where({ ID: req.data.ID });

        const request = await SELECT.one
            .from(PurchaseRequests)
            .where({ ID: item.request_ID });

        await createAuditLog(req, {

            requestID: request.ID,

            requestNumber: request.requestNumber,

            action: "ITEM_DELETED",

            oldStatus: request.status,

            newStatus: request.status,

            role: getUserRole(req),

            remarks: `Material ${item.materialNumber} deleted`

        });

    });

    this.after('READ', 'AuditLogs', logs => {
        const set = log => {
            switch (log.newStatus) {
                case 'Draft':
                    log.criticality = 2;
                    break;
                case 'Submitted':
                    log.criticality = 3;
                    break;
                case 'Approved':
                    log.criticality = 3;
                    break;
                case 'Rejected':
                    log.criticality = 1;
                    break;
                default:
                    log.criticality = 0;
            }
        };

        Array.isArray(logs) ? logs.forEach(set) : set(logs);
    });

});




